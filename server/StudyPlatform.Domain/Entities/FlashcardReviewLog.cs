namespace StudyPlatform.Domain.Entities;

/// <summary>
/// Append-only log of FSRS reviews. Powers retention analytics (predicted vs. actual recall)
/// and future per-user FSRS weight optimization. One row per rating submitted.
/// </summary>
public class FlashcardReviewLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid FlashcardId { get; set; }

    /// <summary>1=Again, 2=Hard, 3=Good, 4=Easy.</summary>
    public int Rating { get; set; }

    /// <summary>FSRS state before the review (0=New, 1=Learning, 2=Review, 3=Relearning).</summary>
    public int StateBefore { get; set; }
    public double StabilityBefore { get; set; }
    public double DifficultyBefore { get; set; }

    /// <summary>Days since the previous review (0 for first review).</summary>
    public int ElapsedDays { get; set; }

    /// <summary>Model-predicted recall probability at the moment of review.</summary>
    public double PredictedRetrievability { get; set; }

    public double StabilityAfter { get; set; }
    public double DifficultyAfter { get; set; }
    public int ScheduledDays { get; set; }

    public DateTime ReviewedAt { get; set; }
}
