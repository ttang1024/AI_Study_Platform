using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class StudySessionRepository : Repository<StudySession>, IStudySessionRepository
{
    public StudySessionRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<StudySession>> GetByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(s => s.UserId == userId && s.OccurredAt >= from.Date && s.OccurredAt < to.Date.AddDays(1))
            .ToListAsync(cancellationToken);
}
