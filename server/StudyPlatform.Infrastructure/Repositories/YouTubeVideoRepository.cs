using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
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

    public async Task<(IEnumerable<YouTubeVideoListItem> Items, int TotalCount)> GetPagedLiteAsync(
        Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.Where(v => v.UserId == userId);

        var totalCount = await query.CountAsync(cancellationToken);
        // Projecting in the query keeps the heavy text columns (Summary, MindMapText,
        // Transcript) out of the SQL SELECT entirely — only the labeling fields are read.
        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new YouTubeVideoListItem(
                v.YouTubeVideoId,
                v.CourseId,
                v.Course.CourseName,
                v.Course.CourseColor,
                v.VideoId,
                v.VideoUrl,
                string.IsNullOrWhiteSpace(v.SourceType) ? "youtube" : v.SourceType,
                v.Title,
                v.ThumbnailUrl,
                v.CreatedAt))
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

    public async Task<YouTubeVideo?> GetByVideoIdAsync(string videoId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(v => v.VideoId == videoId, cancellationToken);

    public async Task<YouTubeVideo?> GetByVideoIdForUserAsync(string videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(v => v.VideoId == videoId && v.UserId == userId, cancellationToken);
}
