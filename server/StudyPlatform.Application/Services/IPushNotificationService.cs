namespace StudyPlatform.Application.Services;

/// <summary>
/// Push subscription management and message delivery. Endpoints are either browser
/// Web Push subscriptions (need VAPID keys; skipped when unconfigured) or native
/// Expo push tokens ("ExponentPushToken[...]", delivered via Expo's push API).
/// </summary>
public interface IPushNotificationService
{
    /// <summary>The VAPID public key browsers need to create a subscription; empty when push is disabled.</summary>
    string PublicKey { get; }

    Task SubscribeAsync(Guid userId, string endpoint, string p256dh, string auth, CancellationToken ct = default);

    Task UnsubscribeAsync(Guid userId, string endpoint, CancellationToken ct = default);

    /// <summary>Send a notification to every device the user has subscribed. Dead subscriptions are pruned.</summary>
    Task SendToUserAsync(Guid userId, string title, string body, string? url = null, CancellationToken ct = default);
}
