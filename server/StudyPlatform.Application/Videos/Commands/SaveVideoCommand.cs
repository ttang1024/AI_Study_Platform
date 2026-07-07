using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record SaveVideoCommand(
    Guid UserId,
    Guid CourseId,
    string VideoId,
    string VideoUrl,
    string? SourceType,
    string Title,
    string ThumbnailUrl,
    string? Summary) : IRequest<Result<VideoDto>>;

public class SaveVideoCommandHandler : IRequestHandler<SaveVideoCommand, Result<VideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly AppLimitsOptions _limits;

    public SaveVideoCommandHandler(IUnitOfWork unitOfWork, IOptions<AppLimitsOptions> limits)
    {
        _unitOfWork = unitOfWork;
        _limits = limits.Value;
    }

    public async Task<Result<VideoDto>> Handle(SaveVideoCommand request, CancellationToken cancellationToken)
    {
        // Look for an existing record with the same YouTube videoId so we can reuse cached AI content
        var sourceType = NormalizeSourceType(request.SourceType);

        if (sourceType == "upload" && _limits.VideoUploadLimit >= 0)
        {
            var count = await _unitOfWork.Videos.CountAsync(
                v => v.UserId == request.UserId && v.SourceType == "upload",
                cancellationToken);
            if (count >= _limits.VideoUploadLimit)
                return Result<VideoDto>.Failure(
                    $"Upload limit of {_limits.VideoUploadLimit} videos per account reached.",
                    "VIDEO_LIMIT_REACHED");
        }

        var previousRecords = (await _unitOfWork.Videos.FindAsync(
            v => v.UserId == request.UserId && v.ExternalVideoId == request.VideoId && v.SourceType == sourceType,
            cancellationToken)).ToList();

        var sourceRecord = previousRecords
            .OrderByDescending(v => v.UpdatedAt)
            .FirstOrDefault(v => v.Summary != null || v.MindMapText != null);

        var video = new Video
        {
            VideoId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            ExternalVideoId = request.VideoId,
            VideoUrl = request.VideoUrl,
            SourceType = sourceType,
            Title = request.Title,
            ThumbnailUrl = request.ThumbnailUrl,
            Summary = sourceRecord?.Summary ?? request.Summary,
            MindMapText = sourceRecord?.MindMapText,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Videos.AddAsync(video, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Copy flashcards and quiz from the source record if available
        if (sourceRecord != null)
        {
            var srcFlashcards = (await _unitOfWork.Flashcards.FindAsync(
                f => f.VideoId == sourceRecord.VideoId,
                cancellationToken)).ToList();

            foreach (var fc in srcFlashcards)
            {
                await _unitOfWork.Flashcards.AddAsync(new Flashcard
                {
                    FlashcardId = Guid.NewGuid(),
                    UserId = request.UserId,
                    VideoId = video.VideoId,
                    SourceType = "video",
                    Front = fc.Front,
                    Back = fc.Back,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }, cancellationToken);
            }

            var srcQuizzes = (await _unitOfWork.Quizzes.FindAsync(
                q => q.VideoId == sourceRecord.VideoId,
                cancellationToken)).ToList();

            foreach (var q in srcQuizzes)
            {
                await _unitOfWork.Quizzes.AddAsync(new Quiz
                {
                    QuizId = Guid.NewGuid(),
                    UserId = request.UserId,
                    VideoId = video.VideoId,
                    SourceType = "video",
                    Question = q.Question,
                    OptionsJson = q.OptionsJson,
                    CorrectAnswer = q.CorrectAnswer,
                    Explanation = q.Explanation,
                    CreatedAt = DateTime.UtcNow
                }, cancellationToken);
            }

            if (srcFlashcards.Count > 0 || srcQuizzes.Count > 0)
                await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // Reload with course navigation property
        var saved = await _unitOfWork.Videos.GetByIdForUserAsync(video.VideoId, request.UserId, cancellationToken);

        return Result<VideoDto>.Success(ToDto(saved!));
    }

    public static VideoDto ToDto(Video v) => new(
        v.VideoId,
        v.CourseId,
        v.Course.CourseName,
        v.Course.CourseColor,
        v.ExternalVideoId,
        v.VideoUrl,
        string.IsNullOrWhiteSpace(v.SourceType) ? "youtube" : v.SourceType,
        v.Title,
        v.ThumbnailUrl,
        v.Summary,
        v.MindMapText,
        v.CreatedAt,
        v.UpdatedAt);

    private static string NormalizeSourceType(string? sourceType) => sourceType?.Trim().ToLowerInvariant() switch
    {
        "bilibili" => "bilibili",
        "upload" => "upload",
        "vimeo" => "vimeo",
        "ted" => "ted",
        "dailymotion" => "dailymotion",
        "facebook" => "facebook",
        "instagram" => "instagram",
        "twitter" => "twitter",
        "reddit" => "reddit",
        "linkedin" => "linkedin",
        "tiktok" => "tiktok",
        _ => "youtube"
    };
}
