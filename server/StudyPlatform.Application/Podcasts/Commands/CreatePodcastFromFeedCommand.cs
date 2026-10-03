using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Podcasts.Commands;

public record CreatePodcastFromFeedCommand(
    Guid UserId,
    Guid CourseId,
    string FeedUrl,
    string EpisodeId) : IRequest<Result<DocumentDto>>;

public class CreatePodcastFromFeedCommandHandler : IRequestHandler<CreatePodcastFromFeedCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPodcastEpisodeService _podcastService;

    public CreatePodcastFromFeedCommandHandler(IUnitOfWork unitOfWork, IPodcastEpisodeService podcastService)
    {
        _unitOfWork = unitOfWork;
        _podcastService = podcastService;
    }

    public async Task<Result<DocumentDto>> Handle(CreatePodcastFromFeedCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        // Re-fetch the feed server-side so episode metadata can't be spoofed by the client.
        var feed = await _podcastService.GetFeedAsync(request.FeedUrl, cancellationToken);
        if (feed == null)
            return Result<DocumentDto>.Failure(
                "Could not read a podcast feed at that link. Check that it is an RSS feed URL.",
                "FEED_FETCH_FAILED");

        var episode = feed.Episodes.FirstOrDefault(e => e.Id == request.EpisodeId)
            ?? feed.Episodes.FirstOrDefault(e => e.AudioUrl == request.EpisodeId);
        if (episode == null)
            return Result<DocumentDto>.Failure("Episode not found in this feed.", "EPISODE_NOT_FOUND");

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = request.CourseId,
            UserId = request.UserId,
            FileName = episode.Title,
            BlobUrl = episode.AudioUrl,
            ContentType = "audio/podcast",
            FileSize = 0,
            OriginalUrl = string.IsNullOrEmpty(episode.Link) ? episode.AudioUrl : episode.Link,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(document.ToDocumentDto(), "Podcast episode saved.");
    }
}
