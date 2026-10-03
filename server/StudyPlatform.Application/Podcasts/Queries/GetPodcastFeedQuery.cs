using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Podcasts.Queries;

public record GetPodcastFeedQuery(string FeedUrl) : IRequest<Result<PodcastFeedInfo>>;

public class GetPodcastFeedQueryHandler : IRequestHandler<GetPodcastFeedQuery, Result<PodcastFeedInfo>>
{
    private readonly IPodcastEpisodeService _podcastService;

    public GetPodcastFeedQueryHandler(IPodcastEpisodeService podcastService)
    {
        _podcastService = podcastService;
    }

    public async Task<Result<PodcastFeedInfo>> Handle(GetPodcastFeedQuery request, CancellationToken cancellationToken)
    {
        var feed = await _podcastService.GetFeedAsync(request.FeedUrl, cancellationToken);
        if (feed == null)
            return Result<PodcastFeedInfo>.Failure(
                "Could not read a podcast feed at that link. Check that it is an RSS feed URL.",
                "FEED_FETCH_FAILED");

        return Result<PodcastFeedInfo>.Success(feed);
    }
}
