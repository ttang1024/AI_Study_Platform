namespace StudyPlatform.Application.Videos;

/// <summary>
/// The canonical spelling of a video's source.
///
/// <para>The source type is written on save and read back on every transcript fetch and cache-key
/// build, in both the API and Application layers. Normalising in one place is what keeps a video
/// saved as "Bilibili" from missing the cache entry written for "bilibili" — and what makes an
/// unknown source fall back to YouTube consistently rather than per call site.</para>
/// </summary>
public static class VideoSourceTypes
{
    public const string Default = "youtube";

    private static readonly HashSet<string> Known =
    [
        "bilibili", "upload", "vimeo", "ted", "dailymotion",
        "facebook", "instagram", "twitter", "reddit", "linkedin", "tiktok",
    ];

    public static string Normalize(string? sourceType)
    {
        var trimmed = sourceType?.Trim().ToLowerInvariant();
        return trimmed != null && Known.Contains(trimmed) ? trimmed : Default;
    }
}
