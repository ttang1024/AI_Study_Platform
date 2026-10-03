using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class FeedbackRepository : Repository<Feedback>, IFeedbackRepository
{
    public FeedbackRepository(AppDbContext context) : base(context) { }

    public async Task<FeedbackStats> GetStatsAsync(DateTime since, CancellationToken cancellationToken = default)
    {
        var byType = await CountByAsync(f => f.Type, cancellationToken);
        var byStatus = await CountByAsync(f => f.Status, cancellationToken);

        var totals = await _dbSet
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                AverageRating = g.Where(f => f.Rating != null).Average(f => (double?)f.Rating),
                Recent = g.Count(f => f.SubmittedAt >= since),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return new FeedbackStats(
            totals?.Total ?? 0,
            WithKeys(byType, "bug", "feature", "general"),
            WithKeys(byStatus, "new", "read", "in_progress", "resolved", "archived"),
            totals?.AverageRating,
            totals?.Recent ?? 0);
    }

    private async Task<Dictionary<string, int>> CountByAsync(
        Expression<Func<Feedback, string>> selector, CancellationToken cancellationToken)
        => await _dbSet
            .AsNoTracking()
            .GroupBy(selector)
            .Select(g => new { Key = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

    /// <summary>The dashboard renders a fixed set of buckets, so absent ones have to come back as zero.</summary>
    private static Dictionary<string, int> WithKeys(Dictionary<string, int> counts, params string[] keys)
        => keys.ToDictionary(key => key, key => counts.GetValueOrDefault(key));

    public async Task<(IEnumerable<Feedback> Items, int Total)> ListAsync(
        int page, int pageSize,
        string? status, string? type, string? search, string? sort,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(f => f.Status == status);

        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(f => f.Type == type);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLowerInvariant();
            query = query.Where(f =>
                f.Subject.ToLower().Contains(lower) ||
                f.Message.ToLower().Contains(lower) ||
                (f.UserEmail != null && f.UserEmail.ToLower().Contains(lower)));
        }

        query = sort switch
        {
            "oldest" => query.OrderBy(f => f.SubmittedAt),
            "rating" => query.OrderByDescending(f => f.Rating),
            _ => query.OrderByDescending(f => f.SubmittedAt) // newest (default)
        };

        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return (items, total);
    }
}
