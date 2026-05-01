using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class FeedbackRepository : Repository<Feedback>, IFeedbackRepository
{
    public FeedbackRepository(AppDbContext context) : base(context) { }

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
