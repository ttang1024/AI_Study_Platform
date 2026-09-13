namespace StudyPlatform.Domain.Entities;

/// <summary>
/// Per-user tuning of the FSRS scheduler. One row per user, created lazily on first read —
/// a missing row means "every default", which is what the algorithm ships with.
/// </summary>
public class UserFsrsSettings
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>
    /// Recall probability the scheduler aims for when it picks the next interval. Lower means
    /// longer intervals and fewer reviews at the cost of forgetting more; 0.9 is the FSRS default
    /// and reproduces the original interval = stability behaviour exactly.
    /// </summary>
    public double DesiredRetention { get; set; } = 0.9;

    /// <summary>Ceiling on any scheduled interval, in days. 36500 (~100 years) is effectively "no cap".</summary>
    public int MaximumIntervalDays { get; set; } = 36500;

    /// <summary>
    /// Spread intervals by a few percent so cards learned on the same day don't stay welded into
    /// the same review pile forever. Deterministic per card, so an interval never changes on re-read.
    /// </summary>
    public bool EnableFuzz { get; set; } = true;

    /// <summary>
    /// How many never-seen cards a session may introduce per day. Both clients hard-coded 20
    /// before this existed; that stays the default.
    /// </summary>
    public int NewCardsPerDay { get; set; } = 20;

    /// <summary>
    /// Ceiling on cards offered per day, new and due together. 0 means no ceiling — the queue is
    /// however long the schedule made it.
    /// </summary>
    public int MaxReviewsPerDay { get; set; }

    /// <summary>
    /// The 19 FSRS weights fitted to this user's own review history, as a JSON array.
    /// Null means the stock FSRS-4.5 weights.
    /// </summary>
    public string? WeightsJson { get; set; }

    public DateTime? WeightsOptimizedAt { get; set; }

    /// <summary>How many reviews the last optimization run was fitted on — shown so the user can judge it.</summary>
    public int ReviewsAtOptimization { get; set; }

    /// <summary>Binary log-loss of the stock weights on that same history (lower is better).</summary>
    public double? LogLossBefore { get; set; }

    /// <summary>Binary log-loss of the fitted weights. Weights are only stored when this improved.</summary>
    public double? LogLossAfter { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
