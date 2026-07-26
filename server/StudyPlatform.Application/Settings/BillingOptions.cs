namespace StudyPlatform.Application.Settings;

public class BillingOptions
{
    public const string SectionName = "Billing";

    /// <summary>
    /// Payment-processor secret key. When empty the whole billing feature is off: a no-op provider
    /// is bound, everyone sits on the free plan, and the UI hides upgrade affordances. This is the
    /// normal state for a self-hosted install.
    /// </summary>
    public string? SecretKey { get; set; }

    /// <summary>Endpoint signing secret. Without it webhooks are rejected rather than trusted.</summary>
    public string? WebhookSecret { get; set; }

    public string? ProPriceId { get; set; }
    public string? TeamPriceId { get; set; }
}

/// <summary>
/// Server-held AI keys lent to subscribers on plans that include them, so that paying users do not
/// also have to go and get their own provider account.
/// </summary>
public class HostedAiOptions
{
    public const string SectionName = "HostedAi";

    /// <summary>Provider these keys belong to, e.g. "gemini" or "anthropic".</summary>
    public string? Provider { get; set; }

    /// <summary>Model served to hosted-key users.</summary>
    public string? Model { get; set; }

    /// <summary>
    /// The key itself. Absent in most deployments — hosted keys are opt-in, and a deployment
    /// without one simply keeps every user on bring-your-own-key.
    /// </summary>
    public string? ApiKey { get; set; }
}
