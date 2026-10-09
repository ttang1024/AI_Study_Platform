namespace StudyPlatform.Application.Videos.Transcripts;

/// <summary>One timed chunk of a video transcript or subtitle track.</summary>
public record TranscriptSegmentDto(double StartSeconds, string Text);

/// <summary>
/// The two segment tracks stored per video: author <see cref="Subtitles"/> (preferred) and the
/// auto-generated <see cref="Transcript"/>.
/// </summary>
public static class TranscriptKinds
{
    public const string Transcript = "transcript";
    public const string Subtitles = "subtitles";
}

/// <summary>Cache keys for per-video generated content, single-sourced for the controller and the provider.</summary>
public static class VideoCacheKeys
{
    public static string Transcript(string videoKey) => $"transcript:{videoKey}";
    public static string TranscriptSegments(string videoKey) => $"transcript_segments:{videoKey}";
    public static string Subtitles(string videoKey) => $"subtitles:{videoKey}";
    public static string MindMap(string videoId) => $"mindmap:{videoId}";
    public static string Summary(string videoId) => $"summary:{videoId}";
    public static string Quiz(string videoId) => $"quiz:{videoId}";
    public static string Flashcards(string videoId) => $"flashcards:{videoId}";
    public static string Glossary(Guid videoRecordId, Guid userId) => $"glossary:video:{videoRecordId}:{userId}";
    public static string Quiz(Guid videoRecordId, Guid userId, string difficulty) => $"quiz:video:{videoRecordId}:{userId}:{difficulty}";
}
