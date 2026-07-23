using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class FlashcardSrsDataRepository : Repository<FlashcardSrsData>, IFlashcardSrsDataRepository
{
    public FlashcardSrsDataRepository(AppDbContext context) : base(context) { }

    public async Task<FlashcardSrsData?> GetByUserAndFlashcardAsync(Guid userId, Guid flashcardId, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(s => s.UserId == userId && s.FlashcardId == flashcardId, ct);

    public async Task<IEnumerable<FlashcardSrsData>> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet.Where(s => s.UserId == userId).ToListAsync(ct);

    /// <remarks>
    /// No Include on Flashcard: every caller either counts these rows or looks the cards up separately,
    /// and pulling the card dragged its Document — extracted text, transcript and all — along with it.
    /// </remarks>
    public async Task<IEnumerable<FlashcardSrsData>> GetDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.Due <= asOf)
            .ToListAsync(ct);

    public async Task<int> CountDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default)
        => await _dbSet.CountAsync(s => s.UserId == userId && s.Due <= asOf, ct);
}
