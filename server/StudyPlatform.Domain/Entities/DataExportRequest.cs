namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A user's request for a copy of everything the platform holds on them.
///
/// <para>A row rather than a synchronous download because the export walks every table the user
/// appears in and can take minutes on a large library — long past the point a request would time
/// out. The row is also the rate limit: a pending or running request blocks a second one, so a
/// user hammering the button cannot queue up dozens of full-library walks.</para>
///
/// <para>Replica-affine in the same way AI jobs are: the worker that picks a request up is whichever
/// instance accepted it. Unlike AI jobs there are no per-caller credentials involved, so a request
/// stranded by a restart is safe for any replica to reclaim once it goes stale.</para>
/// </summary>
public class DataExportRequest
{
    public Guid DataExportRequestId { get; set; }
    public Guid UserId { get; set; }

    /// <summary><c>Pending</c> | <c>Running</c> | <c>Completed</c> | <c>Failed</c>.</summary>
    public string Status { get; set; } = DataExportStatus.Pending;

    /// <summary>Where the finished ZIP landed. Null until the export completes.</summary>
    public string? BlobUrl { get; set; }

    public long? SizeBytes { get; set; }

    /// <summary>Failure reason, shown to the user so a failed export is actionable rather than silent.</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// When the archive stops being downloadable and is eligible for deletion.
    ///
    /// <para>An export is the single most sensitive object the platform produces — one file holding
    /// a user's entire history. It expires so a link leaked from a mailbox or a shared machine stops
    /// working, rather than staying live for the lifetime of the account.</para>
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
}

public static class DataExportStatus
{
    public const string Pending = "Pending";
    public const string Running = "Running";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
}
