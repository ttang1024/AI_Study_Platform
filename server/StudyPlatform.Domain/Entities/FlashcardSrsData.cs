namespace StudyPlatform.Domain.Entities;

/// <summary>
/// Stores per-user FSRS (Free Spaced Repetition Scheduler) state for a flashcard.
/// State: 0=New, 1=Learning, 2=Review, 3=Relearning
/// </summary>
public class FlashcardSrsData
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid FlashcardId { get; set; }

    public int State { get; set; } = 0;
    public double Stability { get; set; } = 0;
    public double Difficulty { get; set; } = 0;

    public int Reps { get; set; } = 0;
    public int Lapses { get; set; } = 0;
    public int ScheduledDays { get; set; } = 0;
    public int ElapsedDays { get; set; } = 0;

    public DateTime? LastReview { get; set; }
    public DateTime Due { get; set; }

    public Flashcard? Flashcard { get; set; }
}
