using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class AuditLogRepository : Repository<AuditLogEntry>, IAuditLogRepository
{
    public AuditLogRepository(AppDbContext context) : base(context) { }

    public async Task<(IReadOnlyList<AuditLogEntry> Items, int Total)> GetForUserAsync(
        Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Where(e => e.ActorUserId == userId || e.SubjectUserId == userId);

        return await PageAsync(query, page, pageSize, cancellationToken);
    }

    public async Task<(IReadOnlyList<AuditLogEntry> Items, int Total)> GetAllAsync(
        Guid? actorUserId, string? action, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsNoTracking();

        if (actorUserId != null)
            query = query.Where(e => e.ActorUserId == actorUserId);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(e => e.Action == action);

        return await PageAsync(query, page, pageSize, cancellationToken);
    }

    private static async Task<(IReadOnlyList<AuditLogEntry> Items, int Total)> PageAsync(
        IQueryable<AuditLogEntry> query, int page, int pageSize, CancellationToken cancellationToken)
    {
        var total = await query.CountAsync(cancellationToken);

        var items = await query
            // Id breaks ties: entries written in the same operation share a timestamp to the
            // millisecond, and an unstable order would shuffle them between pages.
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.AuditLogEntryId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }
}
