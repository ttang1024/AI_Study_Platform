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
            .Where(s => s.UserId == userId && s.Due <= asOf && !s.IsSuspended)
            .ToListAsync(ct);

    public async Task<int> CountDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default)
        => await _dbSet.CountAsync(s => s.UserId == userId && s.Due <= asOf && !s.IsSuspended, ct);

    public async Task<IReadOnlyDictionary<DateTime, int>> GetDueCountsByDayAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken ct = default)
    {
        // Grouped by Due.Date in SQL rather than by pulling the rows back: the scheduler asks this
        // on every review, and the answer is a handful of integers either way.
        var rows = await _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId && !s.IsSuspended && s.Due >= from && s.Due <= to)
            .GroupBy(s => s.Due.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return rows.ToDictionary(
            r => DateTime.SpecifyKind(r.Day, DateTimeKind.Utc),
            r => r.Count);
    }

    public async Task<IReadOnlyList<FlashcardSrsData>> GetOverdueByUserIdAsync(
        Guid userId, DateTime asOf, CancellationToken ct = default)
        => await _dbSet
            .Where(s => s.UserId == userId && !s.IsSuspended && s.Due < asOf)
            .OrderBy(s => s.Due)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<(FlashcardSrsData Srs, Flashcard Card)>> GetLeechesByUserIdAsync(
        Guid userId, int minLapses, CancellationToken ct = default)
    {
        // Anonymous projection instead of Include for the same reason as above — the srs row
        // and the card's own columns, nothing hanging off the card.
        var rows = await _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.Lapses >= minLapses)
            .OrderByDescending(s => s.Lapses)
            .ThenBy(s => s.Due)
            .Select(s => new { s, Card = s.Flashcard! })
            .ToListAsync(ct);
        return rows.Select(r => (r.s, r.Card)).ToList();
    }
}
