using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class DocumentRepository : Repository<Document>, IDocumentRepository
{
    public DocumentRepository(AppDbContext context) : base(context) { }

    // The three-way split behind MaterialCounts, inlined because EF only translates expressions it can
    // see. "audio/podcast" is already covered by the "audio/" prefix; a document is whatever is left
    // once articles and audio are taken out.
    public async Task<MaterialCounts> GetMaterialCountsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var row = await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Articles = g.Count(d => d.OriginalUrl != null && d.ContentType.StartsWith("text/")),
                Audio = g.Count(d => d.ContentType.StartsWith("audio/")),
                Documents = g.Count(d => !(d.OriginalUrl != null && d.ContentType.StartsWith("text/"))
                                         && !d.ContentType.StartsWith("audio/")),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row == null
            ? MaterialCounts.Empty
            : new MaterialCounts(row.Documents, row.Articles, row.Audio);
    }

    public async Task<IReadOnlyDictionary<Guid, MaterialCounts>> GetMaterialCountsByCourseAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        var rows = await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId)
            .GroupBy(d => d.CourseId)
            .Select(g => new
            {
                CourseId = g.Key,
                Articles = g.Count(d => d.OriginalUrl != null && d.ContentType.StartsWith("text/")),
                Audio = g.Count(d => d.ContentType.StartsWith("audio/")),
                Documents = g.Count(d => !(d.OriginalUrl != null && d.ContentType.StartsWith("text/"))
                                         && !d.ContentType.StartsWith("audio/")),
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            r => r.CourseId,
            r => new MaterialCounts(r.Documents, r.Articles, r.Audio));
    }

    public async Task<IReadOnlyDictionary<Guid, Guid>> GetDocumentCourseMapAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId)
            .Select(d => new { d.DocumentId, d.CourseId })
            .ToDictionaryAsync(r => r.DocumentId, r => r.CourseId, cancellationToken);

    public async Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.CourseId == courseId && d.UserId == userId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.CourseId == courseId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PendingTranscription>> GetPendingTranscriptionsAsync(CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.TranscriptionRequestedAt != null && (d.Transcript == null || d.Transcript == ""))
            .Select(d => new PendingTranscription(d.DocumentId, d.UserId, d.ContentType, d.TranscriptionRequestedAt!.Value))
            .ToListAsync(cancellationToken);

    public async Task<DocumentSourceRef?> GetSourceRefAsync(Guid documentId, Guid ownerId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.DocumentId == documentId && d.UserId == ownerId)
            .Select(d => new DocumentSourceRef(d.ContentType, d.BlobUrl))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> GetBlobUrlsByCourseAsync(Guid courseId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.CourseId == courseId)
            .Select(d => d.BlobUrl)
            .ToListAsync(cancellationToken);

    public async Task<bool> BelongsToUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.AnyAsync(d => d.DocumentId == documentId && d.UserId == userId, cancellationToken);

    public async Task<IEnumerable<Document>> GetByUserIdAsync(Guid userId, DateTime date, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.UserId == userId && d.CreatedAt.Date == date.Date)
            .ToListAsync(cancellationToken);

    public async Task<(IEnumerable<Document> Items, int TotalCount)> GetAllByUserIdAsync(Guid userId, int page, int pageSize, Guid? courseId, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsNoTracking().Where(d => d.UserId == userId);
        if (courseId.HasValue)
            query = query.Where(d => d.CourseId == courseId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Page(page, pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Document?> GetByUserIdAndFileHashAsync(Guid userId, string fileHash, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.UserId == userId && d.FileHash == fileHash)
            .OrderByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.CountAsync(d => d.UserId == userId, cancellationToken);

    public async Task<IEnumerable<Document>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var pattern = LikePattern.Contains(query);
        return await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId &&
                        (EF.Functions.ILike(d.FileName, pattern, LikePattern.Escape) ||
                         (d.Summary != null && EF.Functions.ILike(d.Summary, pattern, LikePattern.Escape))))
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentListItem>> GetRecentUntestedAsync(
        Guid userId, IReadOnlyCollection<Guid> excludeDocumentIds, int limit, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId && !excludeDocumentIds.Contains(d.DocumentId))
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .Select(d => new DocumentListItem(d.DocumentId, d.CourseId, d.FileName, d.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task SaveSummaryAsync(Guid id, string summary, CancellationToken cancellationToken = default)
        => await _dbSet.Where(x => x.DocumentId == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.Summary, summary)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public async Task SaveMindMapAsync(Guid id, string mindMapText, CancellationToken cancellationToken = default)
        => await _dbSet.Where(x => x.DocumentId == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.MindMapText, mindMapText)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public async Task<IReadOnlyList<SourceCourse>> GetSourceCoursesByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new SourceCourse(x.DocumentId, x.CourseId, x.FileName))
            .ToListAsync(cancellationToken);
}
