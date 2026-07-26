using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class SubscriptionRepository : Repository<Subscription>, ISubscriptionRepository
{
    public SubscriptionRepository(AppDbContext context) : base(context) { }

    public async Task<Subscription?> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId, cancellationToken);

    public async Task<Subscription?> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.OrganizationId == organizationId, cancellationToken);

    public async Task<IEnumerable<Subscription>> GetByOrganizationsAsync(
        IEnumerable<Guid> organizationIds, CancellationToken cancellationToken = default)
    {
        var ids = organizationIds.ToList();
        if (ids.Count == 0) return Array.Empty<Subscription>();

        return await _dbSet
            .AsNoTracking()
            .Where(s => s.OrganizationId != null && ids.Contains(s.OrganizationId.Value))
            .ToListAsync(cancellationToken);
    }

    public async Task<Subscription?> GetByExternalIdAsync(
        string externalCustomerId, string? externalSubscriptionId, CancellationToken cancellationToken = default)
    {
        // Prefer the subscription id: a customer can hold more than one over time, and the newer
        // one must not be matched by a webhook describing the old.
        if (!string.IsNullOrEmpty(externalSubscriptionId))
        {
            var bySubscription = await _dbSet.FirstOrDefaultAsync(
                s => s.ExternalSubscriptionId == externalSubscriptionId, cancellationToken);
            if (bySubscription != null) return bySubscription;
        }

        return await _dbSet.FirstOrDefaultAsync(
            s => s.ExternalCustomerId == externalCustomerId, cancellationToken);
    }
}
