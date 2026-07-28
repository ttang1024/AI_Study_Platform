using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class VideoRepository : Repository<Video>, IVideoRepository
{
    public VideoRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<VideoGraphNode>> GetGraphNodesAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId)
            .Select(v => new VideoGraphNode(
                v.VideoId,
                v.CourseId,
                v.Title,
                v.ExternalVideoId,
                // Evaluated as a NOT NULL / <> '' test in SQL — the transcript itself is never read.
                (v.Summary != null && v.Summary != "")
                    || (v.MindMapText != null && v.MindMapText != "")
                    || (v.Transcript != null && v.Transcript != "")))
            .ToListAsync(cancellationToken);

    public async Task<(IEnumerable<Video> Items, int TotalCount)> GetPagedAsync(
        Guid userId, Guid? courseId, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
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

    public async Task<(IEnumerable<VideoListItem> Items, int TotalCount)> GetPagedLiteAsync(
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
            .Select(v => new VideoListItem(
                v.VideoId,
                v.CourseId,
                v.Course.CourseName,
                v.Course.CourseColor,
                v.ExternalVideoId,
                v.VideoUrl,
                string.IsNullOrWhiteSpace(v.SourceType) ? "youtube" : v.SourceType,
                v.Title,
                v.ThumbnailUrl,
                v.CreatedAt))
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<IReadOnlyDictionary<Guid, int>> GetCountsByCourseAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId)
            .GroupBy(v => v.CourseId)
            .Select(g => new { CourseId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(r => r.CourseId, r => r.Count, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, Guid>> GetVideoCourseMapAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId)
            .Select(v => new { v.VideoId, v.CourseId })
            .ToDictionaryAsync(r => r.VideoId, r => r.CourseId, cancellationToken);

    public async Task<IEnumerable<Video>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var pattern = $"%{query}%";
        return await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId &&
                        (EF.Functions.ILike(v.Title, pattern) ||
                         (v.Summary != null && EF.Functions.ILike(v.Summary, pattern))))
            .OrderByDescending(v => v.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<Video?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(v => v.Course)
            .FirstOrDefaultAsync(v => v.VideoId == id && v.UserId == userId, cancellationToken);

    public async Task<Video?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(v => v.Course)
            .FirstOrDefaultAsync(v => v.VideoId == id, cancellationToken);

    public async Task<Video?> GetByExternalVideoIdAsync(string externalVideoId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(v => v.ExternalVideoId == externalVideoId, cancellationToken);
}
