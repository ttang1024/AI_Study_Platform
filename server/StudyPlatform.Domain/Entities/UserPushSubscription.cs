namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A browser Web Push subscription for one user + device. The endpoint is unique per
/// device/browser; a user can hold several (laptop, phone). LastNotifiedAt throttles
/// the daily due-review push so a device gets at most one reminder per day.
/// </summary>
public class UserPushSubscription
{
    public Guid UserPushSubscriptionId { get; set; }
    public Guid UserId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastNotifiedAt { get; set; }

    public User User { get; set; } = null!;
}
