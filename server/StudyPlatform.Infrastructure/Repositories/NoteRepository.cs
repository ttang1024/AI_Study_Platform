using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class NoteRepository : Repository<Note>, INoteRepository
{
    public NoteRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Note>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(n => n.Document)
            .Include(n => n.Video)
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<Note>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(n => n.DocumentId == documentId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByIdsAsync(IEnumerable<Guid> ids, Guid userId, CancellationToken cancellationToken = default)
    {
        var idList = ids.ToList();
        var notes = await _dbSet
            .Where(n => idList.Contains(n.NoteId) && n.UserId == userId)
            .ToListAsync(cancellationToken);
        _dbSet.RemoveRange(notes);
    }

    public async Task<(IEnumerable<Note> Items, int TotalCount)> GetPagedByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(n => n.Document)
            .Include(n => n.Video)
            .Where(n => n.UserId == userId);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(n => n.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<IEnumerable<Note>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var pattern = $"%{query}%";
        return await _dbSet
            .AsNoTracking()
            .Where(n => n.UserId == userId &&
                        ((n.Title != null && EF.Functions.ILike(n.Title, pattern)) ||
                         EF.Functions.ILike(n.Content, pattern)))
            .OrderByDescending(n => n.UpdatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }
}
