namespace StudyPlatform.Application.Services;

public record PodcastEpisodeInfo(
    string Title,
    string ShowName,
    string AudioUrl,
    string ThumbnailUrl,
    string Description,
    int DurationMs);

public record PodcastFeedEpisode(
    string Id,
    string Title,
    string AudioUrl,
    string Link,
    string Description,
    string ThumbnailUrl,
    int DurationMs,
    DateTime? PublishedAt);

public record PodcastFeedInfo(
    string Title,
    string ThumbnailUrl,
    List<PodcastFeedEpisode> Episodes);

/// <summary>
/// Resolves a podcast episode page URL (Apple Podcasts, Overcast, Castro, Podbean, …)
/// or a direct audio file URL into episode metadata plus a playable audio URL,
/// and parses podcast RSS feeds into an episode list.
/// </summary>
public interface IPodcastEpisodeService
{
    Task<PodcastEpisodeInfo?> GetEpisodeInfoAsync(string episodeUrl, CancellationToken cancellationToken = default);
    Task<PodcastFeedInfo?> GetFeedAsync(string feedUrl, CancellationToken cancellationToken = default);
    Task<(byte[] AudioData, string MimeType)?> DownloadAudioAsync(string audioUrl, CancellationToken cancellationToken = default);
}
