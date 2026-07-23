using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class CourseRepository : Repository<Course>, ICourseRepository
{
    public CourseRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<CourseListItem>> GetListItemsByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new CourseListItem(
                c.CourseId,
                c.UserId,
                c.CourseName,
                c.CourseColor,
                c.Documents.Count,
                c.CreatedAt,
                c.UpdatedAt))
            .ToListAsync(cancellationToken);

    public async Task<CourseListItem?> GetListItemByIdAsync(Guid courseId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(c => c.CourseId == courseId)
            .Select(c => new CourseListItem(
                c.CourseId,
                c.UserId,
                c.CourseName,
                c.CourseColor,
                c.Documents.Count,
                c.CreatedAt,
                c.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<bool> BelongsToUserAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.AnyAsync(c => c.CourseId == courseId && c.UserId == userId, cancellationToken);
}
