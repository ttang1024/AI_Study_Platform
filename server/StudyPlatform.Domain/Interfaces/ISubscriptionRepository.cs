using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface ISubscriptionRepository : IRepository<Subscription>
{
    Task<Subscription?> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Subscription?> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>Organization subscriptions covering any of the given organizations.</summary>
    Task<IEnumerable<Subscription>> GetByOrganizationsAsync(
        IEnumerable<Guid> organizationIds, CancellationToken cancellationToken = default);

    /// <summary>Looks a subscription up from a webhook payload, which only carries provider ids.</summary>
    Task<Subscription?> GetByExternalIdAsync(
        string externalCustomerId, string? externalSubscriptionId, CancellationToken cancellationToken = default);
}
