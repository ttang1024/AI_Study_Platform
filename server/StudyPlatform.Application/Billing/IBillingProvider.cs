namespace StudyPlatform.Application.Billing;

public record CheckoutSession(string Url, string ExternalSessionId);

/// <summary>A billing event the provider has told us about, already normalized.</summary>
public record BillingEvent(
    string Type,
    string? ExternalCustomerId,
    string? ExternalSubscriptionId,
    string? PlanKey,
    string? Status,
    DateTime? CurrentPeriodEnd);

/// <summary>
/// The seam over whichever payment processor is configured.
///
/// Kept provider-agnostic so the rest of the codebase never imports a payment SDK, and so an
/// unconfigured deployment can bind a no-op implementation instead — self-hosted installs have no
/// billing at all, and must not be forced to hold API keys for a processor they never use.
/// </summary>
public interface IBillingProvider
{
    /// <summary>False when no processor is configured; callers should hide upgrade affordances.</summary>
    bool IsEnabled { get; }

    Task<CheckoutSession?> CreateCheckoutSessionAsync(
        Guid userId, string email, string planKey, string successUrl, string cancelUrl,
        CancellationToken cancellationToken = default);

    /// <summary>Portal where the customer manages or cancels their own subscription.</summary>
    Task<string?> CreatePortalUrlAsync(
        string externalCustomerId, string returnUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies a webhook's signature and normalizes its payload. Returns null when the signature
    /// does not verify — an unverified billing event must never be allowed to grant a plan.
    /// </summary>
    BillingEvent? ParseWebhook(string payload, string? signatureHeader);
}
