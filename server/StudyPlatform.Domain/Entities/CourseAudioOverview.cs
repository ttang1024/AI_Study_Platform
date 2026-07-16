namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A generated two-host audio overview of a course (NotebookLM-style). The AI writes a
/// dialogue script from the course's materials, each line is synthesized with a per-speaker
/// TTS voice, and the stitched MP3 is stored in blob storage.
/// </summary>
public class CourseAudioOverview
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid CourseId { get; set; }

    /// <summary>"pending" | "processing" | "ready" | "failed"</summary>
    public string Status { get; set; } = "pending";

    /// <summary>JSON array of { speaker, text } dialogue turns.</summary>
    public string? ScriptJson { get; set; }

    public string? AudioUrl { get; set; }
    public int DurationSeconds { get; set; }
    public string? Error { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public Course? Course { get; set; }
}
