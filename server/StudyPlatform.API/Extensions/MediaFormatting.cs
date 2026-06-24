namespace StudyPlatform.API.Extensions;

/// <summary>
/// Shared formatting helpers for media playback and transcript timelines,
/// used by the video, document and share controllers.
/// </summary>
public static class MediaFormatting
{
    /// <summary>Formats a number of seconds as <c>mm:ss</c> (or <c>h:mm:ss</c> past an hour).</summary>
    public static string FormatTimestamp(double seconds)
    {
        var time = TimeSpan.FromSeconds(Math.Max(0, seconds));
        return time.TotalHours >= 1
            ? $"{(int)time.TotalHours}:{time.Minutes:D2}:{time.Seconds:D2}"
            : $"{time.Minutes:D2}:{time.Seconds:D2}";
    }

    /// <summary>Maps a stored video blob URL to a streaming content type by file extension.</summary>
    public static string GetVideoContentType(string blobUrl)
    {
        var path = blobUrl;
        if (Uri.TryCreate(blobUrl, UriKind.Absolute, out var uri))
            path = uri.AbsolutePath;

        return Path.GetExtension(Uri.UnescapeDataString(path)).ToLowerInvariant() switch
        {
            ".mp4" or ".m4v" => "video/mp4",
            ".mov" => "video/quicktime",
            ".webm" => "video/webm",
            ".mkv" => "video/x-matroska",
            ".avi" => "video/x-msvideo",
            _ => "application/octet-stream"
        };
    }
}
