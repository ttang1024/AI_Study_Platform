using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Podcasts.Commands;

public record CreatePodcastEpisodeCommand(
    Guid UserId,
    Guid CourseId,
    string ApplePodcastsUrl) : IRequest<Result<DocumentDto>>;

public class CreatePodcastEpisodeCommandHandler : IRequestHandler<CreatePodcastEpisodeCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplePodcastService _podcastService;

    public CreatePodcastEpisodeCommandHandler(IUnitOfWork unitOfWork, IApplePodcastService podcastService)
    {
        _unitOfWork = unitOfWork;
        _podcastService = podcastService;
    }

    public async Task<Result<DocumentDto>> Handle(CreatePodcastEpisodeCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        var info = await _podcastService.GetEpisodeInfoAsync(request.ApplePodcastsUrl, cancellationToken);
        if (info == null)
            return Result<DocumentDto>.Failure(
                "Could not fetch podcast episode. Please check the Apple Podcasts URL.",
                "PODCAST_FETCH_FAILED");

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = request.CourseId,
            UserId = request.UserId,
            FileName = info.Title,
            BlobUrl = info.AudioUrl,
            ContentType = "audio/podcast",
            FileSize = 0,
            OriginalUrl = request.ApplePodcastsUrl,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(new DocumentDto(
            document.DocumentId, document.CourseId, document.UserId,
            document.FileName, document.BlobUrl, document.ContentType,
            document.FileSize, document.FileHash, document.Summary, document.MindMapText,
            document.CreatedAt, document.UpdatedAt,
            document.Transcript, document.OriginalUrl),
            "Podcast episode saved.");
    }
}
