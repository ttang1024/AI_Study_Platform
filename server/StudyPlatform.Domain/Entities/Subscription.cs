namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A paid plan held by a user or by an organization.
///
/// Exactly one of <see cref="UserId"/> / <see cref="OrganizationId"/> is set. An organization
/// subscription covers all of its members, which is the whole point of the Team plan — a school
/// buys once rather than per teacher.
/// </summary>
public class Subscription
{
    public Guid SubscriptionId { get; set; }

    public Guid? UserId { get; set; }
    public Guid? OrganizationId { get; set; }

    /// <summary>Key into the code-side plan catalog (free / pro / team).</summary>
    public string PlanKey { get; set; } = "free";

    /// <summary>One of <see cref="SubscriptionStatuses"/>.</summary>
    public string Status { get; set; } = SubscriptionStatuses.Active;

    /// <summary>
    /// End of the paid period. Entitlements survive until this moment even after a cancellation,
    /// because someone who paid through the end of the month keeps what they paid for.
    /// </summary>
    public DateTime? CurrentPeriodEnd { get; set; }

    /// <summary>Customer id at the billing provider. Null for plans that never touched checkout.</summary>
    public string? ExternalCustomerId { get; set; }

    public string? ExternalSubscriptionId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User? User { get; set; }
    public Organization? Organization { get; set; }
}

public static class SubscriptionStatuses
{
    public const string Active = "active";

    /// <summary>Payment failed but the grace period has not elapsed; entitlements still apply.</summary>
    public const string PastDue = "past_due";

    /// <summary>Cancelled; entitlements apply until CurrentPeriodEnd, then lapse to Free.</summary>
    public const string Cancelled = "cancelled";

    /// <summary>Terminated immediately, e.g. by chargeback. No entitlements.</summary>
    public const string Revoked = "revoked";

    /// <summary>Statuses that still grant the plan's entitlements, subject to CurrentPeriodEnd.</summary>
    public static bool GrantsEntitlements(string status) => status is Active or PastDue or Cancelled;
}
