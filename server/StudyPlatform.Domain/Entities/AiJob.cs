namespace StudyPlatform.Domain.Entities;

public static class AiJobStatus
{
    public const string Queued = "queued";
    public const string Running = "running";
    public const string Succeeded = "succeeded";
    public const string Failed = "failed";
}

public static class AiJobType
{
    public const string Flashcards = "flashcards";
    public const string Quiz = "quiz";
    public const string Glossary = "glossary";
}

/// <summary>
/// A deferred AI generation. Generating flashcards or a quiz from a long document takes tens of
/// seconds; running that inside the HTTP request holds a connection open the whole time, gives the
/// user no progress, and turns a slow model into a gateway timeout with nothing to retry.
///
/// The provider credentials deliberately live only in the in-memory queue entry, never here — an API
/// key at rest in the database is a liability, and a job that outlives a restart can simply be failed
/// and retried by the user.
/// </summary>
public class AiJob
{
    public Guid AiJobId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>One of <see cref="AiJobType"/>.</summary>
    public string JobType { get; set; } = string.Empty;

    public Guid DocumentId { get; set; }

    /// <summary>Only meaningful for quiz jobs.</summary>
    public string? Difficulty { get; set; }

    /// <summary>One of <see cref="AiJobStatus"/>.</summary>
    public string Status { get; set; } = AiJobStatus.Queued;

    public string? Error { get; set; }

    /// <summary>
    /// Which API instance accepted this job.
    ///
    /// <para>Jobs are replica-affine and cannot be handed over: the provider credentials live only
    /// in the accepting instance's in-memory queue entry, never in this row, so no other replica
    /// could run it even if it wanted to. Recording the owner keeps a second replica from claiming
    /// a job it cannot execute, and makes a stranded job traceable to the instance that lost it.</para>
    /// </summary>
    public string? OwnerInstanceId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
    public Document Document { get; set; } = null!;
}
