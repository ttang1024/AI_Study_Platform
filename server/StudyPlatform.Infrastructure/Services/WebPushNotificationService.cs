using System.Net.Http.Json;
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

/// <summary>
/// Delivers push notifications to every device a user has registered. Two kinds of
/// subscription share the UserPushSubscriptions table, distinguished by endpoint shape:
/// browser Web Push subscriptions (a push-service URL + VAPID crypto keys) and native
/// mobile devices (an Expo push token like "ExponentPushToken[...]", sent through
/// Expo's push API — p256dh/auth hold the "expo" placeholder for those rows).
/// Web delivery is skipped when VAPID keys are not configured; Expo delivery needs no keys.
/// </summary>
public class WebPushNotificationService : IPushNotificationService
{
    private const string ExpoPushEndpoint = "https://exp.host/--/api/v2/push/send";

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _db;
    private readonly HttpClient _httpClient;
    private readonly ILogger<WebPushNotificationService> _logger;
    private readonly VapidOptions _options;

    public WebPushNotificationService(
        AppDbContext db,
        HttpClient httpClient,
        IOptions<VapidOptions> options,
        ILogger<WebPushNotificationService> logger)
    {
        _db = db;
        _httpClient = httpClient;
        _logger = logger;
        _options = options.Value;
    }

    public string PublicKey => _options.IsConfigured ? _options.PublicKey : string.Empty;

    private static bool IsExpoToken(string endpoint)
        => endpoint.StartsWith("ExponentPushToken[", StringComparison.Ordinal)
           || endpoint.StartsWith("ExpoPushToken[", StringComparison.Ordinal);

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
        var subscriptions = await _db.UserPushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);
        if (subscriptions.Count == 0) return;

        var dirty = false;
        foreach (var sub in subscriptions)
        {
            var delivered = IsExpoToken(sub.Endpoint)
                ? await SendExpoAsync(sub, title, body, url, ct)
                : await SendWebPushAsync(sub, title, body, url, ct);
            dirty |= delivered;
        }

        if (dirty)
            await _db.SaveChangesAsync(ct);
    }

    /// <returns>true when the subscription row changed (delivered or pruned).</returns>
    private async Task<bool> SendWebPushAsync(UserPushSubscription sub, string title, string body, string? url, CancellationToken ct)
    {
        if (!_options.IsConfigured) return false;

        var client = new WebPushClient();
        var vapid = new VapidDetails(_options.Subject, _options.PublicKey, _options.PrivateKey);
        var payload = JsonSerializer.Serialize(new { title, body, url }, SerializerOptions);

        try
        {
            await client.SendNotificationAsync(
                new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth), payload, vapid, ct);
            sub.LastNotifiedAt = DateTime.UtcNow;
            return true;
        }
        catch (WebPushException ex) when (
            ex.StatusCode == System.Net.HttpStatusCode.Gone
            || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // The browser dropped this subscription — clean it up.
            _db.UserPushSubscriptions.Remove(sub);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Web push delivery failed for user {UserId}", sub.UserId);
            return false;
        }
    }

    /// <returns>true when the subscription row changed (delivered or pruned).</returns>
    private async Task<bool> SendExpoAsync(UserPushSubscription sub, string title, string body, string? url, CancellationToken ct)
    {
        try
        {
            var message = new
            {
                to = sub.Endpoint,
                title,
                body,
                sound = "default",
                data = new { url },
            };
            var response = await _httpClient.PostAsJsonAsync(ExpoPushEndpoint, message, SerializerOptions, ct);
            var result = await response.Content.ReadFromJsonAsync<ExpoPushResponse>(SerializerOptions, ct);

            var ticket = result?.Data;
            if (ticket?.Status == "ok")
            {
                sub.LastNotifiedAt = DateTime.UtcNow;
                return true;
            }

            if (ticket?.Details?.Error == "DeviceNotRegistered")
            {
                // The device uninstalled the app or revoked notifications — clean it up.
                _db.UserPushSubscriptions.Remove(sub);
                return true;
            }

            _logger.LogWarning(
                "Expo push delivery failed for user {UserId}: {Status} {Error}",
                sub.UserId, ticket?.Status ?? response.StatusCode.ToString(), ticket?.Details?.Error);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Expo push delivery failed for user {UserId}", sub.UserId);
            return false;
        }
    }

    private sealed record ExpoPushResponse(ExpoPushTicket? Data);
    private sealed record ExpoPushTicket(string? Status, ExpoPushTicketDetails? Details);
    private sealed record ExpoPushTicketDetails(string? Error);
}
