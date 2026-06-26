using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class FlashcardRepository : Repository<Flashcard>, IFlashcardRepository
{
    public FlashcardRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Flashcard>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(f => f.Document)
            .Include(f => f.YouTubeVideo)
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<Flashcard>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(f => f.DocumentId == documentId)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByIdsAsync(IEnumerable<Guid> ids, Guid userId, CancellationToken cancellationToken = default)
    {
        var idList = ids.ToList();
        var flashcards = await _dbSet
            .Where(f => idList.Contains(f.FlashcardId) && f.UserId == userId)
            .ToListAsync(cancellationToken);
        _dbSet.RemoveRange(flashcards);
    }

    public async Task<(IEnumerable<Flashcard> Items, int TotalCount)> GetPagedByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(f => f.Document)
            .Include(f => f.YouTubeVideo)
            .Where(f => f.UserId == userId);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> YouTubeVideoIds)> GetCoverageByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var documentIds = await _dbSet
            .Where(f => f.UserId == userId && f.DocumentId != null)
            .Select(f => f.DocumentId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var youTubeVideoIds = await _dbSet
            .Where(f => f.UserId == userId && f.YouTubeVideoId != null)
            .Select(f => f.YouTubeVideoId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        return (documentIds, youTubeVideoIds);
    }

    public async Task<IEnumerable<Flashcard>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var pattern = $"%{query}%";
        return await _dbSet
            .AsNoTracking()
            .Where(f => f.UserId == userId &&
                        (EF.Functions.ILike(f.Front, pattern) || EF.Functions.ILike(f.Back, pattern)))
            .OrderByDescending(f => f.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }
}
