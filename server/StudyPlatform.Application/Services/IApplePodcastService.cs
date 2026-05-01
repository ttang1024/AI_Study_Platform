namespace StudyPlatform.Application.Services;

public record PodcastEpisodeInfo(
    string Title,
    string ShowName,
    string AudioUrl,
    string ThumbnailUrl,
    string Description,
    int DurationMs);

public interface IApplePodcastService
{
    Task<PodcastEpisodeInfo?> GetEpisodeInfoAsync(string applePodcastsUrl, CancellationToken cancellationToken = default);
    Task<(byte[] AudioData, string MimeType)?> DownloadAudioAsync(string audioUrl, CancellationToken cancellationToken = default);
}
