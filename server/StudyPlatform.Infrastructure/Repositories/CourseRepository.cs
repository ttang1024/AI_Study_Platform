using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class CourseRepository : Repository<Course>, ICourseRepository
{
    public CourseRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Course>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Documents)
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<Course?> GetByIdWithDocumentsAsync(Guid courseId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Documents)
            .FirstOrDefaultAsync(c => c.CourseId == courseId, cancellationToken);

    public async Task<bool> BelongsToUserAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.AnyAsync(c => c.CourseId == courseId && c.UserId == userId, cancellationToken);
}
