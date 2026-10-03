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

    public async Task<FlashcardReviewLog?> GetLatestAsync(Guid userId, Guid? flashcardId = null, CancellationToken ct = default)
    {
        var query = _dbSet.Where(l => l.UserId == userId);
        if (flashcardId.HasValue)
            query = query.Where(l => l.FlashcardId == flashcardId.Value);
        return await query.OrderByDescending(l => l.ReviewedAt).FirstOrDefaultAsync(ct);
    }

    public async Task<FlashcardReviewLog?> GetPreviousAsync(Guid userId, Guid flashcardId, DateTime before, CancellationToken ct = default)
        => await _dbSet
            .Where(l => l.UserId == userId && l.FlashcardId == flashcardId && l.ReviewedAt < before)
            .OrderByDescending(l => l.ReviewedAt)
            .FirstOrDefaultAsync(ct);
}
