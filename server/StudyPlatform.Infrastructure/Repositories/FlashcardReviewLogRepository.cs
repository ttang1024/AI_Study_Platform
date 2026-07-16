using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class FlashcardReviewLogRepository : Repository<FlashcardReviewLog>, IFlashcardReviewLogRepository
{
    public FlashcardReviewLogRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<FlashcardReviewLog>> GetByUserAsync(Guid userId, DateTime? since = null, CancellationToken ct = default)
    {
        var query = _dbSet.Where(l => l.UserId == userId);
        if (since.HasValue)
            query = query.Where(l => l.ReviewedAt >= since.Value);
        return await query.OrderBy(l => l.ReviewedAt).ToListAsync(ct);
    }
}
