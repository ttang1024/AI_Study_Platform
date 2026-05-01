namespace StudyPlatform.Application.Services;

public record TranscriptSegment(TimeSpan Start, string Text);
public record PlaylistVideoItem(string VideoId, string Title, string ThumbnailUrl);

public sealed class YouTubeTranscriptUnavailableException : Exception
{
    public YouTubeTranscriptUnavailableException(string videoId)
        : base($"YouTube transcript service is temporarily unavailable for video {videoId}.")
    {
    }

    public YouTubeTranscriptUnavailableException(string videoId, Exception innerException)
        : base($"YouTube transcript service is temporarily unavailable for video {videoId}.", innerException)
    {
    }
}

public interface IYouTubeTranscriptService
{
    /// <summary>
    /// Returns timed caption segments for a YouTube video, or null if none are available.
    /// </summary>
    Task<IReadOnlyList<TranscriptSegment>?> GetTranscriptAsync(string videoId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the raw, unprocessed caption lines for a YouTube video, or null if none are available.
    /// </summary>
    Task<IReadOnlyList<TranscriptSegment>?> GetSubtitlesAsync(string videoId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a list of video metadata for all videos in a YouTube playlist.
    /// </summary>
    Task<IReadOnlyList<PlaylistVideoItem>> GetPlaylistItemsAsync(string playlistId, CancellationToken cancellationToken = default);
}
