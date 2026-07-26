using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Resolves the plan in force for a user.
///
/// Cached, because this is consulted on every AI call and every quota check. The cache is short and
/// is invalidated explicitly on billing changes, so an upgrade takes effect immediately while a
/// missed invalidation self-heals within the TTL.
/// </summary>
public class EntitlementService : IEntitlementService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    // Resolved through a scope of its own rather than an injected IUnitOfWork: this service is a
    // singleton, because the quota gate (itself a singleton) consults it on every AI call.
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAppCache _cache;
    private readonly ILogger<EntitlementService> _logger;

    public EntitlementService(IServiceScopeFactory scopeFactory, IAppCache cache, ILogger<EntitlementService> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _logger = logger;
    }

    private static string CacheKey(Guid userId) => $"entitlement:{userId}";

    public async Task<Entitlement> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        if (userId == Guid.Empty) return Entitlement.Default;

        var cached = await _cache.GetAsync<CachedEntitlement>(CacheKey(userId), cancellationToken);
        if (cached != null)
            return new Entitlement(
                PlanCatalog.ByKey(cached.PlanKey), cached.Source, cached.OrganizationId, cached.ExpiresAt);

        try
        {
            var resolved = await ResolveAsync(userId, cancellationToken);

            await _cache.SetAsync(
                CacheKey(userId),
                new CachedEntitlement(resolved.Plan.Key, resolved.Source, resolved.OrganizationId, resolved.ExpiresAt),
                CacheTtl,
                cancellationToken);

            return resolved;
        }
        catch (Exception ex)
        {
            // Degrade rather than fail: a billing lookup that errors must not block someone from
            // studying material they already have.
            _logger.LogWarning(ex, "Entitlement lookup failed for {UserId}; falling back to the free plan.", userId);
            return Entitlement.Default;
        }
    }

    public Task InvalidateAsync(Guid userId, CancellationToken cancellationToken = default)
        => _cache.RemoveAsync(CacheKey(userId), cancellationToken);

    private async Task<Entitlement> ResolveAsync(Guid userId, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var candidates = new List<Entitlement>();

        var own = await unitOfWork.Subscriptions.GetByUserAsync(userId, cancellationToken);
        if (own != null && IsCurrent(own))
            candidates.Add(new Entitlement(PlanCatalog.ByKey(own.PlanKey), "user", null, own.CurrentPeriodEnd));

        // An organization subscription covers every member, which is the point of the Team plan.
        var memberships = await unitOfWork.OrganizationMembers
            .FindAsNoTrackingAsync(m => m.UserId == userId, cancellationToken);

        var orgIds = memberships.Select(m => m.OrganizationId).Distinct().ToList();
        if (orgIds.Count > 0)
        {
            var orgSubs = await unitOfWork.Subscriptions.GetByOrganizationsAsync(orgIds, cancellationToken);
            candidates.AddRange(orgSubs
                .Where(IsCurrent)
                .Select(s => new Entitlement(
                    PlanCatalog.ByKey(s.PlanKey), "organization", s.OrganizationId, s.CurrentPeriodEnd)));
        }

        if (candidates.Count == 0) return Entitlement.Default;

        // Best plan wins when someone is covered twice — a teacher who also pays for Pro personally
        // should not be downgraded by their school's plan, or the reverse.
        return candidates
            .OrderByDescending(e => PlanRank(e.Plan.Key))
            .First();
    }

    private static bool IsCurrent(Subscription s)
    {
        if (!SubscriptionStatuses.GrantsEntitlements(s.Status)) return false;

        // A cancelled subscription keeps its entitlements until the period they paid for ends.
        return s.CurrentPeriodEnd == null || s.CurrentPeriodEnd > DateTime.UtcNow;
    }

    private static int PlanRank(string key) => key switch
    {
        PlanCatalog.TeamKey => 3,
        PlanCatalog.ProKey => 2,
        _ => 1
    };

    /// <summary>Cache shape. Stores the plan key rather than the plan so a deploy that changes a
    /// limit takes effect on the next read instead of serving a stale copy of the old limits.</summary>
    private sealed record CachedEntitlement(string PlanKey, string Source, Guid? OrganizationId, DateTime? ExpiresAt);
}
