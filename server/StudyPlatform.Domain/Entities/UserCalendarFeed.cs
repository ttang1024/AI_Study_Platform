namespace StudyPlatform.Domain.Entities;

/// <summary>
/// An external ICS calendar the user subscribed to (Google/Outlook/Apple "secret address" URL).
/// Busy blocks from these feeds let the planner schedule study around real commitments.
/// </summary>
public class UserCalendarFeed
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime? LastSyncedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
}
