using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class QuizBattleRepository : Repository<QuizBattle>, IQuizBattleRepository
{
    private readonly AppDbContext _context;

    public QuizBattleRepository(AppDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<IEnumerable<QuizBattle>> GetByGroupWithEntriesAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await _context.QuizBattles
            .AsNoTracking()
            .Include(b => b.Entries).ThenInclude(e => e.User)
            .Where(b => b.GroupId == groupId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<QuizBattle?> GetByIdWithEntriesAsync(Guid battleId, CancellationToken cancellationToken = default)
        => await _context.QuizBattles
            .Include(b => b.Entries).ThenInclude(e => e.User)
            .FirstOrDefaultAsync(b => b.QuizBattleId == battleId, cancellationToken);

    // Entries must be added through the DbSet, not a tracked battle's navigation
    // collection: their Guid key is pre-set, so DetectChanges would classify a
    // navigation-discovered entry as Modified and issue an UPDATE that matches
    // no row (DbUpdateConcurrencyException).
    public async Task AddEntryAsync(QuizBattleEntry entry, CancellationToken cancellationToken = default)
        => await _context.QuizBattleEntries.AddAsync(entry, cancellationToken);
}
