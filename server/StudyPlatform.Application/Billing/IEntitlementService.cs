namespace StudyPlatform.Application.Billing;

/// <summary>
/// The plan currently in force for a user, and where it came from.
/// </summary>
/// <param name="Plan">Effective plan. Never null — an unsubscribed user is on Free.</param>
/// <param name="Source">"user", "organization", or "default".</param>
/// <param name="OrganizationId">Set when the plan comes from an organization subscription.</param>
/// <param name="ExpiresAt">End of the paid period, when there is one.</param>
public record Entitlement(Plan Plan, string Source, Guid? OrganizationId = null, DateTime? ExpiresAt = null)
{
    public static Entitlement Default => new(PlanCatalog.Free, "default");
}

public interface IEntitlementService
{
    /// <summary>
    /// Resolves the plan in force for a user: the best of their own subscription and any
    /// organization subscription covering them. Falls back to Free rather than throwing.
    /// </summary>
    Task<Entitlement> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Invalidates any cached entitlement for a user, after a billing state change.</summary>
    Task InvalidateAsync(Guid userId, CancellationToken cancellationToken = default);
}
