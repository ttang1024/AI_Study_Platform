namespace StudyPlatform.Domain.Entities;

/// <summary>One member's completed run of a quiz battle.</summary>
public class QuizBattleEntry
{
    public Guid QuizBattleEntryId { get; set; }
    public Guid BattleId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>JSON dictionary: { questionId → selectedAnswer }</summary>
    public string AnswersJson { get; set; } = string.Empty;
    public int Score { get; set; }
    public int Total { get; set; }
    public int DurationSeconds { get; set; }
    public DateTime CompletedAt { get; set; }

    public QuizBattle Battle { get; set; } = null!;
    public User User { get; set; } = null!;
}
