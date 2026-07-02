using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;
using WebPush;

namespace StudyPlatform.Infrastructure.Services;

public class WebPushNotificationService : IPushNotificationService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _db;
    private readonly ILogger<WebPushNotificationService> _logger;
    private readonly VapidOptions _options;

    public WebPushNotificationService(AppDbContext db, IOptions<VapidOptions> options, ILogger<WebPushNotificationService> logger)
    {
        _db = db;
        _logger = logger;
        _options = options.Value;
    }

    public string PublicKey => _options.IsConfigured ? _options.PublicKey : string.Empty;

    public async Task SubscribeAsync(Guid userId, string endpoint, string p256dh, string auth, CancellationToken ct = default)
    {
        var existing = await _db.UserPushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == endpoint, ct);
        if (existing is not null)
        {
            // Same device re-subscribing (possibly as a different user after re-login).
            existing.UserId = userId;
            existing.P256dh = p256dh;
            existing.Auth = auth;
        }
        else
        {
            _db.UserPushSubscriptions.Add(new UserPushSubscription
            {
                UserPushSubscriptionId = Guid.NewGuid(),
                UserId = userId,
                Endpoint = endpoint,
                P256dh = p256dh,
                Auth = auth,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task UnsubscribeAsync(Guid userId, string endpoint, CancellationToken ct = default)
    {
        var subscription = await _db.UserPushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint, ct);
        if (subscription is null) return;
        _db.UserPushSubscriptions.Remove(subscription);
        await _db.SaveChangesAsync(ct);
    }

    public async Task SendToUserAsync(Guid userId, string title, string body, string? url = null, CancellationToken ct = default)
    {
        if (!_options.IsConfigured) return;

        var subscriptions = await _db.UserPushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);
        if (subscriptions.Count == 0) return;

        var client = new WebPushClient();
        var vapid = new VapidDetails(_options.Subject, _options.PublicKey, _options.PrivateKey);
        var payload = JsonSerializer.Serialize(new { title, body, url }, SerializerOptions);
        var removed = false;

        foreach (var sub in subscriptions)
        {
            try
            {
                await client.SendNotificationAsync(
                    new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth), payload, vapid, ct);
                sub.LastNotifiedAt = DateTime.UtcNow;
            }
            catch (WebPushException ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.Gone
                || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // The browser dropped this subscription — clean it up.
                _db.UserPushSubscriptions.Remove(sub);
                removed = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Web push delivery failed for user {UserId}", userId);
            }
        }

        if (removed || subscriptions.Count > 0)
            await _db.SaveChangesAsync(ct);
    }
}
