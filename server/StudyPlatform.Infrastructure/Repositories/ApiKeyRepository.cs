using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class ApiKeyRepository : Repository<ApiKey>, IApiKeyRepository
{
    public ApiKeyRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<ApiKey>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(k => k.UserId == userId)
            // Live keys first, then the revoked ones as history.
            .OrderBy(k => k.RevokedAt != null)
            .ThenByDescending(k => k.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<ApiKey?> GetByHashAsync(string keyHash, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.KeyHash == keyHash, cancellationToken);

    public async Task TouchAsync(
        Guid apiKeyId, TimeSpan staleAfter, CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow - staleAfter;

        // A single conditional UPDATE rather than load-modify-save: this runs on the authentication
        // path of every API request, and the WHERE is what keeps a busy key from writing on each one.
        await _dbSet
            .Where(k => k.ApiKeyId == apiKeyId && (k.LastUsedAt == null || k.LastUsedAt < cutoff))
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.LastUsedAt, DateTime.UtcNow), cancellationToken);
    }
}

public class WebhookRepository : Repository<Webhook>, IWebhookRepository
{
    public WebhookRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Webhook>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(w => w.UserId == userId)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Webhook>> GetSubscribersAsync(
        Guid userId, string eventName, CancellationToken cancellationToken = default)
    {
        var active = await _dbSet
            .AsNoTracking()
            .Where(w => w.UserId == userId && w.IsActive)
            .ToListAsync(cancellationToken);

        // Split in memory: Events is comma-joined, and a LIKE would match one event name nested
        // inside a longer one.
        return active
            .Where(w => w.Events
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Contains(eventName))
            .ToList();
    }
}
