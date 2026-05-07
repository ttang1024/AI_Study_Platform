using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class YouTubeVideoRepository : Repository<YouTubeVideo>, IYouTubeVideoRepository
{
    public YouTubeVideoRepository(AppDbContext context) : base(context) { }

    public async Task<(IEnumerable<YouTubeVideo> Items, int TotalCount)> GetPagedAsync(
        Guid userId, Guid? courseId, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .Include(v => v.Course)
            .Where(v => v.UserId == userId);

        if (courseId.HasValue)
            query = query.Where(v => v.CourseId == courseId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(v => EF.Functions.ILike(v.Title, $"%{search}%"));

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<YouTubeVideo?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(v => v.Course)
            .FirstOrDefaultAsync(v => v.YouTubeVideoId == id && v.UserId == userId, cancellationToken);

    public async Task<YouTubeVideo?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(v => v.Course)
            .FirstOrDefaultAsync(v => v.YouTubeVideoId == id, cancellationToken);

    public async Task<YouTubeVideo?> GetByVideoIdForUserAsync(string videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(v => v.VideoId == videoId && v.UserId == userId, cancellationToken);
}
