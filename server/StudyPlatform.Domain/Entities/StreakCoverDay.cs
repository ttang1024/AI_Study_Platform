namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A calendar day (UTC date) on which the user's study streak is protected without studying.
/// "freeze" rows are consumed automatically from the user's earned freezes when a day is missed;
/// "vacation" rows are created up front when the user schedules time off.
/// Covered days keep a streak alive but don't increment it.
/// </summary>
public class StreakCoverDay
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>The UTC date being covered (time component always midnight).</summary>
    public DateTime Date { get; set; }

    /// <summary>"freeze" | "vacation"</summary>
    public string Type { get; set; } = "freeze";

    public DateTime CreatedAt { get; set; }
}
