namespace StudyPlatform.Domain.Entities;

/// <summary>
/// Records a slice of time the user actively spent studying. The frontend sends
/// periodic heartbeats while a study surface is focused; each heartbeat is persisted
/// as one session row and later aggregated for the analytics "time-on-task" charts.
/// </summary>
public class StudySession
{
    public Guid StudySessionId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>Course the activity belongs to, when it can be attributed to one.</summary>
    public Guid? CourseId { get; set; }

    /// <summary>"document" | "video" | "flashcards" | "quiz" | "glossary" | "notes" | "general"</summary>
    public string ContextType { get; set; } = "general";

    /// <summary>Id of the document/video/etc. being studied, when applicable.</summary>
    public Guid? ContextId { get; set; }

    public int DurationSeconds { get; set; }
    public DateTime OccurredAt { get; set; }

    public User User { get; set; } = null!;
}
