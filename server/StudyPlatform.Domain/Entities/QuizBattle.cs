namespace StudyPlatform.Domain.Entities;

/// <summary>
/// An async quiz duel inside a study group. The creator snapshots a set of questions
/// (from their quiz bank) into QuestionsJson so every participant answers the same set;
/// each member submits one entry and the leaderboard ranks by score then time.
/// </summary>
public class QuizBattle
{
    public Guid QuizBattleId { get; set; }
    public Guid GroupId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    /// <summary>JSON array: [{ id, question, options[], correctAnswer, explanation }]</summary>
    public string QuestionsJson { get; set; } = string.Empty;
    public string Status { get; set; } = "open"; // "open" | "closed"
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosesAt { get; set; }

    public StudyGroup Group { get; set; } = null!;
    public ICollection<QuizBattleEntry> Entries { get; set; } = new List<QuizBattleEntry>();
}
