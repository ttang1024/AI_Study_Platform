using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class CourseAudioOverviewRepository : Repository<CourseAudioOverview>, ICourseAudioOverviewRepository
{
    public CourseAudioOverviewRepository(AppDbContext context) : base(context) { }

    public async Task<CourseAudioOverview?> GetLatestForCourseAsync(Guid userId, Guid courseId, CancellationToken ct = default)
        => await _dbSet
            .Where(o => o.UserId == userId && o.CourseId == courseId)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);
}
