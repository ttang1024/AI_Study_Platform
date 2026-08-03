using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Signs and delivers webhook payloads.
///
/// <para>The URL is user-supplied and fetched by the server, which is the textbook SSRF shape — so
/// the <see cref="System.Net.Http.HttpClient"/> injected here is registered with
/// <c>SsrfGuard.CreateHandler()</c>, blocking private, loopback, and metadata addresses on the
/// initial request and on every redirect hop. A plain client here would let anyone turn the platform
/// into a probe of its own network.</para>
///
/// <para>Delivery never propagates a failure to the caller: an unreachable endpoint is the
/// receiver's problem, not a reason to fail the study action that triggered it.</para>
/// </summary>
public class WebhookDispatcher : IWebhookDispatcher
{
    /// <summary>
    /// Consecutive failures before an endpoint is switched off. A URL that has failed this many
    /// times running is gone, and continuing to post is a slow outbound flood at someone's server.
    /// </summary>
    private const int DisableAfterConsecutiveFailures = 20;

    private readonly HttpClient _httpClient;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WebhookDispatcher> _logger;

    public WebhookDispatcher(
        HttpClient httpClient,
        IServiceScopeFactory scopeFactory,
        ILogger<WebhookDispatcher> logger)
    {
        _httpClient = httpClient;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task DispatchAsync(
        Guid userId, string eventName, object payload, CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var subscribers = await db.Webhooks
                .AsNoTracking()
                .Where(w => w.UserId == userId && w.IsActive)
                .ToListAsync(cancellationToken);

            // Filtered in memory: Events is a comma-joined string, and a LIKE over it would match
            // "quiz.completed" inside a hypothetical "quiz.completed.late".
            var targets = subscribers
                .Where(w => w.Events
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Contains(eventName))
                .ToList();

            if (targets.Count == 0)
                return;

            var body = JsonSerializer.Serialize(new
            {
                id = Guid.NewGuid(),
                type = eventName,
                createdAt = DateTime.UtcNow,
                data = payload,
            });

            foreach (var webhook in targets)
                await DeliverAsync(webhook, body, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Webhook dispatch for {Event} failed for user {UserId}", eventName, userId);
        }
    }

    private async Task DeliverAsync(Webhook webhook, string body, CancellationToken cancellationToken)
    {
        int? statusCode = null;
        var succeeded = false;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, webhook.Url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };

            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // The timestamp is signed along with the body so a captured delivery cannot be replayed
            // later — signing the body alone would make every past payload permanently re-postable.
            request.Headers.Add("X-StudyPlatform-Timestamp", timestamp.ToString());
            request.Headers.Add("X-StudyPlatform-Signature", Sign(webhook.Secret, timestamp, body));
            request.Headers.Add("X-StudyPlatform-Webhook-Id", webhook.WebhookId.ToString());

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            statusCode = (int)response.StatusCode;
            succeeded = response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            // Includes the guard rejecting a private address, which is a configuration mistake by the
            // subscriber rather than an error on our side.
            _logger.LogInformation(ex, "Webhook {WebhookId} delivery failed", webhook.WebhookId);
        }

        await RecordOutcomeAsync(webhook.WebhookId, statusCode, succeeded, cancellationToken);
    }

    /// <summary>
    /// <c>HMAC-SHA256(secret, "{timestamp}.{body}")</c>, hex-encoded — the scheme receivers already
    /// know from other platforms, so a subscriber can verify it without bespoke code.
    /// </summary>
    internal static string Sign(string secret, long timestamp, string body)
    {
        var payload = Encoding.UTF8.GetBytes($"{timestamp}.{body}");
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), payload);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task RecordOutcomeAsync(
        Guid webhookId, int? statusCode, bool succeeded, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var webhook = await db.Webhooks.FirstOrDefaultAsync(w => w.WebhookId == webhookId, cancellationToken);
            if (webhook == null)
                return;

            webhook.LastDeliveryAt = DateTime.UtcNow;
            webhook.LastStatusCode = statusCode;
            webhook.ConsecutiveFailures = succeeded ? 0 : webhook.ConsecutiveFailures + 1;

            if (webhook.ConsecutiveFailures >= DisableAfterConsecutiveFailures)
                webhook.IsActive = false;

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record webhook {WebhookId} outcome", webhookId);
        }
    }
}
