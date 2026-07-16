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
}
