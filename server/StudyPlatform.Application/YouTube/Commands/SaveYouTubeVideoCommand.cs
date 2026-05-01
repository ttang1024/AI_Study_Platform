using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Commands;

public record SaveYouTubeVideoCommand(
    Guid UserId,
    Guid CourseId,
    string VideoId,
    string VideoUrl,
    string Title,
    string ThumbnailUrl,
    string? Summary) : IRequest<Result<YouTubeVideoDto>>;

public class SaveYouTubeVideoCommandHandler : IRequestHandler<SaveYouTubeVideoCommand, Result<YouTubeVideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SaveYouTubeVideoCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<YouTubeVideoDto>> Handle(SaveYouTubeVideoCommand request, CancellationToken cancellationToken)
    {
        // Look for an existing record with the same YouTube videoId so we can reuse cached AI content
        var previousRecords = (await _unitOfWork.YouTubeVideos.FindAsync(
            v => v.UserId == request.UserId && v.VideoId == request.VideoId,
            cancellationToken)).ToList();

        var sourceRecord = previousRecords
            .OrderByDescending(v => v.UpdatedAt)
            .FirstOrDefault(v => v.Summary != null || v.MindMapText != null);

        var video = new YouTubeVideo
        {
            YouTubeVideoId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            VideoId = request.VideoId,
            VideoUrl = request.VideoUrl,
            Title = request.Title,
            ThumbnailUrl = request.ThumbnailUrl,
            Summary = sourceRecord?.Summary ?? request.Summary,
            MindMapText = sourceRecord?.MindMapText,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.YouTubeVideos.AddAsync(video, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Copy flashcards and quiz from the source record if available
        if (sourceRecord != null)
        {
            var srcFlashcards = (await _unitOfWork.Flashcards.FindAsync(
                f => f.YouTubeVideoId == sourceRecord.YouTubeVideoId,
                cancellationToken)).ToList();

            foreach (var fc in srcFlashcards)
            {
                await _unitOfWork.Flashcards.AddAsync(new Flashcard
                {
                    FlashcardId = Guid.NewGuid(),
                    UserId = request.UserId,
                    YouTubeVideoId = video.YouTubeVideoId,
                    SourceType = "video",
                    Front = fc.Front,
                    Back = fc.Back,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }, cancellationToken);
            }

            var srcQuizzes = (await _unitOfWork.Quizzes.FindAsync(
                q => q.YouTubeVideoId == sourceRecord.YouTubeVideoId,
                cancellationToken)).ToList();

            foreach (var q in srcQuizzes)
            {
                await _unitOfWork.Quizzes.AddAsync(new Quiz
                {
                    QuizId = Guid.NewGuid(),
                    UserId = request.UserId,
                    YouTubeVideoId = video.YouTubeVideoId,
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
        var saved = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(video.YouTubeVideoId, request.UserId, cancellationToken);

        return Result<YouTubeVideoDto>.Success(ToDto(saved!));
    }

    internal static YouTubeVideoDto ToDto(YouTubeVideo v) => new(
        v.YouTubeVideoId,
        v.CourseId,
        v.Course.CourseName,
        v.Course.CourseColor,
        v.VideoId,
        v.VideoUrl,
        v.Title,
        v.ThumbnailUrl,
        v.Summary,
        v.MindMapText,
        v.CreatedAt,
        v.UpdatedAt);
}
