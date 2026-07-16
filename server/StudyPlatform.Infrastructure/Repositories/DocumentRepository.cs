using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
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

    public async Task<Document?> GetByIdWithDetailsAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(d => d.Notes)
            .Include(d => d.Quizzes)
            .Include(d => d.Flashcards)
            .Include(d => d.ChatMessages)
            .FirstOrDefaultAsync(d => d.DocumentId == documentId, cancellationToken);

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
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
        var pattern = $"%{query}%";
        return await _dbSet
            .AsNoTracking()
            .Where(d => d.UserId == userId &&
                        (EF.Functions.ILike(d.FileName, pattern) ||
                         (d.Summary != null && EF.Functions.ILike(d.Summary, pattern))))
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }
}
