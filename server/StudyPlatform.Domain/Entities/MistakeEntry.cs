namespace StudyPlatform.Domain.Entities;

/// <summary>
/// One question the user answered wrong, auto-collected from quiz submissions into the
/// per-user "mistake notebook". Re-missing the same question bumps TimesMissed; answering
/// it right (or manually marking it) resolves it.
/// </summary>
public class MistakeEntry
{
    public Guid MistakeEntryId { get; set; }
    public Guid UserId { get; set; }
    public Guid? QuizId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public string Question { get; set; } = string.Empty;
    public string OptionsJson { get; set; } = string.Empty;
    public string CorrectAnswer { get; set; } = string.Empty;
    public string UserAnswer { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string Status { get; set; } = "open"; // "open" | "resolved"

    /// <summary>
    /// The flashcard promoted from this mistake, if the user has made one. Set once and kept even after
    /// the mistake resolves — it is what stops a second promotion from creating a duplicate card, and
    /// deleting the card is the user's way of undoing the promotion.
    /// </summary>
    public Guid? FlashcardId { get; set; }

    public int TimesMissed { get; set; } = 1;
    public DateTime FirstMissedAt { get; set; }
    public DateTime LastMissedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public User User { get; set; } = null!;
}
