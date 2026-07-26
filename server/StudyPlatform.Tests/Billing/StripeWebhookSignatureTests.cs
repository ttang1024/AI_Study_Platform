using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Billing;

/// <summary>
/// The webhook is the one anonymous endpoint that can grant a paid plan, so its signature check is
/// the only thing standing between a POST and a free subscription. Every test here is an attempt to
/// get an event accepted that should not be.
/// </summary>
public class StripeWebhookSignatureTests
{
    private const string Secret = "whsec_test_secret";

    private readonly StripeBillingProvider _provider = new(
        new HttpClient(),
        Options.Create(new BillingOptions
        {
            SecretKey = "sk_test_key",
            WebhookSecret = Secret,
            ProPriceId = "price_pro",
        }),
        NullLogger<StripeBillingProvider>.Instance);

    private static string Payload(string status = "active") =>
        "{\"type\":\"customer.subscription.updated\",\"data\":{\"object\":{"
        + "\"id\":\"sub_123\",\"customer\":\"cus_123\",\"status\":\"" + status + "\","
        + "\"current_period_end\":1790000000,"
        + "\"metadata\":{\"userId\":\"11111111-1111-1111-1111-111111111111\",\"planKey\":\"pro\"}"
        + "}}}";

    private static string Sign(string payload, long timestamp, string secret = Secret)
    {
        var signature = Convert.ToHexStringLower(
            HMACSHA256.HashData(
                Encoding.UTF8.GetBytes(secret),
                Encoding.UTF8.GetBytes($"{timestamp}.{payload}")));

        return $"t={timestamp},v1={signature}";
    }

    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    [Fact]
    public void ParseWebhook_ValidSignature_IsAccepted()
    {
        var payload = Payload();

        var evt = _provider.ParseWebhook(payload, Sign(payload, Now));

        Assert.NotNull(evt);
        Assert.Equal("cus_123", evt!.ExternalCustomerId);
        Assert.Equal("sub_123", evt.ExternalSubscriptionId);
        Assert.Equal("pro", evt.PlanKey);
        Assert.Equal("active", evt.Status);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1790000000).UtcDateTime, evt.CurrentPeriodEnd);
    }

    [Fact]
    public void ParseWebhook_WrongSecret_IsRejected()
    {
        var payload = Payload();

        Assert.Null(_provider.ParseWebhook(payload, Sign(payload, Now, "whsec_attacker")));
    }

    [Fact]
    public void ParseWebhook_TamperedPayload_IsRejected()
    {
        // Signature computed over the original body, then the body is swapped for one granting Team.
        var signed = Payload();
        var header = Sign(signed, Now);
        var tampered = signed.Replace("\"planKey\":\"pro\"", "\"planKey\":\"team\"");

        Assert.Null(_provider.ParseWebhook(tampered, header));
    }

    [Fact]
    public void ParseWebhook_MissingSignatureHeader_IsRejected()
    {
        Assert.Null(_provider.ParseWebhook(Payload(), null));
        Assert.Null(_provider.ParseWebhook(Payload(), ""));
    }

    [Fact]
    public void ParseWebhook_ReplayedOldEvent_IsRejected()
    {
        // A correctly signed event captured an hour ago must not still be accepted.
        var payload = Payload();
        var old = DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeSeconds();

        Assert.Null(_provider.ParseWebhook(payload, Sign(payload, old)));
    }

    [Fact]
    public void ParseWebhook_TimestampFarInTheFuture_IsRejected()
    {
        var payload = Payload();
        var future = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();

        Assert.Null(_provider.ParseWebhook(payload, Sign(payload, future)));
    }

    [Fact]
    public void ParseWebhook_MalformedHeader_IsRejected()
    {
        var payload = Payload();

        Assert.Null(_provider.ParseWebhook(payload, "garbage"));
        Assert.Null(_provider.ParseWebhook(payload, "t=,v1="));
        Assert.Null(_provider.ParseWebhook(payload, $"t=notanumber,v1=abc"));
    }

    [Fact]
    public void ParseWebhook_WhenNoWebhookSecretConfigured_IsRejected()
    {
        // A deployment that forgot to set the endpoint secret must reject everything rather than
        // accept everything.
        var unconfigured = new StripeBillingProvider(
            new HttpClient(),
            Options.Create(new BillingOptions { SecretKey = "sk_test_key" }),
            NullLogger<StripeBillingProvider>.Instance);

        var payload = Payload();
        Assert.Null(unconfigured.ParseWebhook(payload, Sign(payload, Now)));
    }

    [Theory]
    [InlineData("past_due", "past_due")]
    [InlineData("canceled", "cancelled")]
    [InlineData("trialing", "active")]
    [InlineData("incomplete_expired", "revoked")]
    public void ParseWebhook_MapsProviderStatusesToOurs(string providerStatus, string expected)
    {
        var payload = Payload(providerStatus);

        var evt = _provider.ParseWebhook(payload, Sign(payload, Now));

        Assert.Equal(expected, evt!.Status);
    }

    [Fact]
    public void ParseWebhook_SubscriptionDeleted_MapsToCancelled()
    {
        var payload = """
            {"type":"customer.subscription.deleted","data":{"object":{
              "id":"sub_123","customer":"cus_123","status":"active"
            }}}
            """;

        var evt = _provider.ParseWebhook(payload, Sign(payload, Now));

        Assert.Equal("cancelled", evt!.Status);
    }
}

/// <summary>The no-op provider is what self-hosted installs run; it must grant nothing.</summary>
public class NullBillingProviderTests
{
    private readonly NullBillingProvider _provider = new();

    [Fact]
    public void IsDisabledAndGrantsNothing()
    {
        Assert.False(_provider.IsEnabled);
        Assert.Null(_provider.ParseWebhook("{}", "t=1,v1=abc"));
    }

    [Fact]
    public async Task CheckoutAndPortalReturnNothing()
    {
        Assert.Null(await _provider.CreateCheckoutSessionAsync(
            Guid.NewGuid(), "a@example.com", "pro", "https://s", "https://c"));
        Assert.Null(await _provider.CreatePortalUrlAsync("cus_1", "https://r"));
    }
}
