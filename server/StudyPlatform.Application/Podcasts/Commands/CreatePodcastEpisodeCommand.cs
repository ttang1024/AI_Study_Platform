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
    string EpisodeUrl) : IRequest<Result<DocumentDto>>;

public class CreatePodcastEpisodeCommandHandler : IRequestHandler<CreatePodcastEpisodeCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPodcastEpisodeService _podcastService;

    public CreatePodcastEpisodeCommandHandler(IUnitOfWork unitOfWork, IPodcastEpisodeService podcastService)
    {
        _unitOfWork = unitOfWork;
        _podcastService = podcastService;
    }

    public async Task<Result<DocumentDto>> Handle(CreatePodcastEpisodeCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        var info = await _podcastService.GetEpisodeInfoAsync(request.EpisodeUrl, cancellationToken);
        if (info == null)
        {
            // The URL may be a podcast RSS feed rather than an episode page —
            // signal the client to load the episode picker instead.
            var feed = await _podcastService.GetFeedAsync(request.EpisodeUrl, cancellationToken);
            if (feed != null)
                return Result<DocumentDto>.Failure(
                    "This link is a podcast feed. Pick an episode from the list.",
                    "RSS_FEED_URL");

            return Result<DocumentDto>.Failure(
                "Could not find a playable episode at that link. Try the episode page URL (Apple Podcasts, Overcast, Castro, Podbean, …), an RSS feed, or a direct MP3 link.",
                "PODCAST_FETCH_FAILED");
        }

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = request.CourseId,
            UserId = request.UserId,
            FileName = info.Title,
            BlobUrl = info.AudioUrl,
            ContentType = "audio/podcast",
            FileSize = 0,
            OriginalUrl = request.EpisodeUrl,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(document.ToDocumentDto(),
            "Podcast episode saved.");
    }
}
