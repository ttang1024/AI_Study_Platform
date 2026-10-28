using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class VideoRepository : Repository<Video>, IVideoRepository
{
    public VideoRepository(AppDbContext context) : base(context) { }

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
        {
            var pattern = LikePattern.Contains(search);
            query = query.Where(v => EF.Functions.ILike(v.Title, pattern, LikePattern.Escape));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Page(page, pageSize)
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
            .Page(page, pageSize)
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
        var pattern = LikePattern.Contains(query);
        return await _dbSet
            .AsNoTracking()
            .Where(v => v.UserId == userId &&
                        (EF.Functions.ILike(v.Title, pattern, LikePattern.Escape) ||
                         (v.Summary != null && EF.Functions.ILike(v.Summary, pattern, LikePattern.Escape))))
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

    public async Task<IReadOnlyList<PendingVideoTranscription>> GetPendingTranscriptionsAsync(CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(v => v.TranscriptionRequestedAt != null && (v.Transcript == null || v.Transcript == ""))
            .Select(v => new PendingVideoTranscription(v.VideoId, v.UserId, v.TranscriptionRequestedAt!.Value))
            .ToListAsync(cancellationToken);

    public async Task<Video?> GetByExternalVideoIdAsync(string externalVideoId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(v => v.ExternalVideoId == externalVideoId, cancellationToken);

    public async Task SaveSummaryAsync(Guid id, string summary, CancellationToken cancellationToken = default)
        => await _dbSet.Where(x => x.VideoId == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.Summary, summary)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public async Task SaveMindMapAsync(Guid id, string mindMapText, CancellationToken cancellationToken = default)
        => await _dbSet.Where(x => x.VideoId == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.MindMapText, mindMapText)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public async Task<IReadOnlyList<string>> GetUploadedFileUrlsByCourseAsync(Guid courseId, CancellationToken cancellationToken = default)
        => (await _dbSet
            .AsNoTracking()
            .Where(v => v.CourseId == courseId && v.SourceType == "upload")
            .Select(v => new { v.VideoUrl, v.ThumbnailUrl })
            .ToListAsync(cancellationToken))
            .SelectMany(v => new[] { v.VideoUrl, v.ThumbnailUrl })
            .Where(u => !string.IsNullOrEmpty(u))
            .ToList();

    public async Task<IReadOnlyList<SourceCourse>> GetSourceCoursesByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new SourceCourse(x.VideoId, x.CourseId, x.Title))
            .ToListAsync(cancellationToken);

    public async Task<bool> AddUploadWithinLimitAsync(Video video, int limit, CancellationToken cancellationToken = default)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async ct =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(ct);
            if (limit >= 0)
            {
                // Serialises uploads per user for the length of this transaction; other users are unaffected.
                var lockKey = $"video-upload:{video.UserId}";
                await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))", ct);
                if (await _dbSet.CountAsync(v => v.UserId == video.UserId && v.SourceType == "upload", ct) >= limit)
                    return false;
            }

            _dbSet.Add(video);
            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }, cancellationToken);
    }
}
