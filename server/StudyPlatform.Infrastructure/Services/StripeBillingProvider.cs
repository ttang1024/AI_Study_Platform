using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Billing when nothing is configured. Self-hosted installs run here permanently: every user sits
/// on the free plan and the UI hides upgrade affordances because <see cref="IsEnabled"/> is false.
/// </summary>
public class NullBillingProvider : IBillingProvider
{
    public bool IsEnabled => false;

    public Task<CheckoutSession?> CreateCheckoutSessionAsync(
        Guid userId, string email, string planKey, string successUrl, string cancelUrl,
        CancellationToken cancellationToken = default)
        => Task.FromResult<CheckoutSession?>(null);

    public Task<string?> CreatePortalUrlAsync(
        string externalCustomerId, string returnUrl, CancellationToken cancellationToken = default)
        => Task.FromResult<string?>(null);

    public BillingEvent? ParseWebhook(string payload, string? signatureHeader) => null;
}

/// <summary>
/// Stripe over its REST API directly, rather than the SDK — the three calls needed here are form
/// posts, and the SDK would be a large dependency carried by every deployment including the ones
/// that never bill anyone.
///
/// Bound only when a secret key is configured; otherwise <see cref="NullBillingProvider"/> is used.
/// </summary>
public class StripeBillingProvider : IBillingProvider
{
    private const string ApiBase = "https://api.stripe.com/v1";

    private readonly HttpClient _httpClient;
    private readonly BillingOptions _options;
    private readonly ILogger<StripeBillingProvider> _logger;

    public StripeBillingProvider(
        HttpClient httpClient, IOptions<BillingOptions> options, ILogger<StripeBillingProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => !string.IsNullOrWhiteSpace(_options.SecretKey);

    public async Task<CheckoutSession?> CreateCheckoutSessionAsync(
        Guid userId, string email, string planKey, string successUrl, string cancelUrl,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled) return null;

        var priceId = planKey switch
        {
            PlanCatalog.ProKey => _options.ProPriceId,
            PlanCatalog.TeamKey => _options.TeamPriceId,
            _ => null
        };
        if (string.IsNullOrWhiteSpace(priceId))
        {
            _logger.LogWarning("No configured price id for plan {PlanKey}.", planKey);
            return null;
        }

        var form = new Dictionary<string, string>
        {
            ["mode"] = "subscription",
            ["line_items[0][price]"] = priceId!,
            ["line_items[0][quantity]"] = "1",
            ["success_url"] = successUrl,
            ["cancel_url"] = cancelUrl,
            ["customer_email"] = email,
            // Echoed back on the webhook: this is how a Stripe customer is tied to our user.
            ["client_reference_id"] = userId.ToString(),
            ["metadata[userId]"] = userId.ToString(),
            ["metadata[planKey]"] = planKey,
            ["subscription_data[metadata][userId]"] = userId.ToString(),
            ["subscription_data[metadata][planKey]"] = planKey,
        };

        var json = await PostFormAsync("checkout/sessions", form, cancellationToken);
        if (json == null) return null;

        var url = json.Value.TryGetProperty("url", out var u) ? u.GetString() : null;
        var id = json.Value.TryGetProperty("id", out var i) ? i.GetString() : null;

        return url == null || id == null ? null : new CheckoutSession(url, id);
    }

    public async Task<string?> CreatePortalUrlAsync(
        string externalCustomerId, string returnUrl, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled) return null;

        var json = await PostFormAsync("billing_portal/sessions", new Dictionary<string, string>
        {
            ["customer"] = externalCustomerId,
            ["return_url"] = returnUrl,
        }, cancellationToken);

        return json?.TryGetProperty("url", out var u) == true ? u.GetString() : null;
    }

    public BillingEvent? ParseWebhook(string payload, string? signatureHeader)
    {
        if (!IsEnabled) return null;

        if (!VerifySignature(payload, signatureHeader))
        {
            _logger.LogWarning("Rejected a billing webhook whose signature did not verify.");
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;

            var type = root.GetProperty("type").GetString() ?? string.Empty;
            var obj = root.GetProperty("data").GetProperty("object");

            string? Str(string name) =>
                obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

            var customerId = Str("customer");
            var subscriptionId = type.StartsWith("customer.subscription", StringComparison.Ordinal)
                ? Str("id")
                : Str("subscription");

            string? planKey = null;
            if (obj.TryGetProperty("metadata", out var metadata)
                && metadata.TryGetProperty("planKey", out var pk))
                planKey = pk.GetString();

            DateTime? periodEnd = null;
            if (obj.TryGetProperty("current_period_end", out var pe) && pe.ValueKind == JsonValueKind.Number)
                periodEnd = DateTimeOffset.FromUnixTimeSeconds(pe.GetInt64()).UtcDateTime;

            var status = MapStatus(type, Str("status"));

            return new BillingEvent(type, customerId, subscriptionId, planKey, status, periodEnd);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not parse a billing webhook payload.");
            return null;
        }
    }

    private static string? MapStatus(string eventType, string? providerStatus) => eventType switch
    {
        "customer.subscription.deleted" => SubscriptionStatusNames.Cancelled,
        _ => providerStatus switch
        {
            "active" or "trialing" => SubscriptionStatusNames.Active,
            "past_due" or "unpaid" => SubscriptionStatusNames.PastDue,
            "canceled" => SubscriptionStatusNames.Cancelled,
            "incomplete_expired" => SubscriptionStatusNames.Revoked,
            _ => null
        }
    };

    /// <summary>
    /// Stripe's scheme: HMAC-SHA256 over "timestamp.payload" with the endpoint secret. Compared in
    /// constant time, and the timestamp is bounded so a captured webhook cannot be replayed later.
    /// </summary>
    private bool VerifySignature(string payload, string? signatureHeader)
    {
        if (string.IsNullOrWhiteSpace(_options.WebhookSecret) || string.IsNullOrWhiteSpace(signatureHeader))
            return false;

        string? timestamp = null;
        var signatures = new List<string>();

        foreach (var part in signatureHeader.Split(',', StringSplitOptions.TrimEntries))
        {
            var separator = part.IndexOf('=');
            if (separator <= 0) continue;

            var key = part[..separator];
            var value = part[(separator + 1)..];

            if (key == "t") timestamp = value;
            else if (key == "v1") signatures.Add(value);
        }

        if (timestamp == null || signatures.Count == 0) return false;

        if (!long.TryParse(timestamp, out var unixSeconds)) return false;
        var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
        if (age > TimeSpan.FromMinutes(5) || age < TimeSpan.FromMinutes(-5)) return false;

        var expected = Convert.ToHexStringLower(
            HMACSHA256.HashData(
                Encoding.UTF8.GetBytes(_options.WebhookSecret!),
                Encoding.UTF8.GetBytes($"{timestamp}.{payload}")));

        return signatures.Any(candidate =>
            CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(candidate),
                Encoding.UTF8.GetBytes(expected)));
    }

    private async Task<JsonElement?> PostFormAsync(
        string path, Dictionary<string, string> form, CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{ApiBase}/{path}")
            {
                Content = new FormUrlEncodedContent(form)
            };
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _options.SecretKey);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Stripe {Path} returned {Status}: {Body}", path, (int)response.StatusCode, body);
                return null;
            }

            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe {Path} call failed.", path);
            return null;
        }
    }
}

/// <summary>
/// Status names duplicated from Domain.SubscriptionStatuses so Infrastructure's billing adapter
/// does not have to reach into Domain for three string constants.
/// </summary>
internal static class SubscriptionStatusNames
{
    public const string Active = "active";
    public const string PastDue = "past_due";
    public const string Cancelled = "cancelled";
    public const string Revoked = "revoked";
}
