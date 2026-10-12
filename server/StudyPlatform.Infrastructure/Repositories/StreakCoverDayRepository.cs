using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class StreakCoverDayRepository : Repository<StreakCoverDay>, IStreakCoverDayRepository
{
    public StreakCoverDayRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<StreakCoverDay>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet.Where(c => c.UserId == userId).ToListAsync(ct);

    public async Task<int> AddFreezeDaysAsync(Guid userId, IReadOnlyCollection<DateTime> dates, CancellationToken ct = default)
    {
        var added = 0;
        foreach (var date in dates)
        {
            var day = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);

            // ON CONFLICT against the (UserId, Date) unique index: a concurrent request that already
            // covered this day wins, and this one adds nothing instead of failing the whole read.
            added += await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO "StreakCoverDays" ("Id", "UserId", "Date", "Type", "CreatedAt")
                VALUES ({Guid.NewGuid()}, {userId}, {day}, 'freeze', {DateTime.UtcNow})
                ON CONFLICT ("UserId", "Date") DO NOTHING
                """,
                ct);
        }
        return added;
    }
}
