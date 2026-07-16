using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class AiUsageRepository : Repository<AiUsageLog>, IAiUsageRepository
{
    public AiUsageRepository(AppDbContext context) : base(context) { }

    private IQueryable<AiUsageLog> InWindow(Guid userId, DateTime from, DateTime to)
        => _dbSet
            .AsNoTracking()
            .Where(u => u.UserId == userId && u.CreatedAt >= from && u.CreatedAt < to);

    public async Task<AiUsageTotals> GetTotalsAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
    {
        var row = await InWindow(userId, from, to)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Calls = g.Count(),
                PromptTokens = g.Sum(u => (long)u.PromptTokens),
                CompletionTokens = g.Sum(u => (long)u.CompletionTokens),
                CachedPromptTokens = g.Sum(u => (long)u.CachedPromptTokens),
                TotalTokens = g.Sum(u => (long)u.TotalTokens),
                Cost = g.Sum(u => u.EstimatedCostUsd),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row == null
            ? AiUsageTotals.Empty
            : new AiUsageTotals(
                row.Calls, row.PromptTokens, row.CompletionTokens,
                row.CachedPromptTokens, row.TotalTokens, row.Cost);
    }

    // The grouped queries below project to an anonymous type and only then build the record. EF cannot
    // translate a constructor call inside a GroupBy projection — it throws at runtime, not compile time —
    // so the shape has to stay anonymous until the rows are materialised.

    public async Task<IReadOnlyList<AiUsageGroup>> GetByOperationAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
    {
        var rows = await InWindow(userId, from, to)
            .GroupBy(u => u.Operation)
            .Select(g => new
            {
                Key = g.Key,
                Calls = g.Count(),
                TotalTokens = g.Sum(u => (long)u.TotalTokens),
                Cost = g.Sum(u => u.EstimatedCostUsd),
            })
            .OrderByDescending(r => r.Cost)
            .ThenByDescending(r => r.TotalTokens)
            .ToListAsync(cancellationToken);

        return rows.Select(r => new AiUsageGroup(r.Key, r.Calls, r.TotalTokens, r.Cost)).ToList();
    }

    public async Task<IReadOnlyList<AiUsageGroup>> GetByModelAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
    {
        var rows = await InWindow(userId, from, to)
            // The provider is part of the identity of a model: "gpt-4o" via two providers is two rates.
            .GroupBy(u => new { u.Provider, u.Model })
            .Select(g => new
            {
                g.Key.Provider,
                g.Key.Model,
                Calls = g.Count(),
                TotalTokens = g.Sum(u => (long)u.TotalTokens),
                Cost = g.Sum(u => u.EstimatedCostUsd),
            })
            .OrderByDescending(r => r.Cost)
            .ThenByDescending(r => r.TotalTokens)
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AiUsageGroup($"{r.Provider}/{r.Model}", r.Calls, r.TotalTokens, r.Cost))
            .ToList();
    }

    public async Task<IReadOnlyList<AiUsageDay>> GetDailyAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
    {
        // Group on the date part in SQL. Projecting to DateOnly inside the query is not translatable,
        // so the grouping key stays a DateTime at midnight and is narrowed after materialising.
        var rows = await InWindow(userId, from, to)
            .GroupBy(u => u.CreatedAt.Date)
            .Select(g => new
            {
                Day = g.Key,
                TotalTokens = g.Sum(u => (long)u.TotalTokens),
                Cost = g.Sum(u => u.EstimatedCostUsd),
            })
            .OrderBy(r => r.Day)
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AiUsageDay(DateOnly.FromDateTime(r.Day), r.TotalTokens, r.Cost))
            .ToList();
    }
}
