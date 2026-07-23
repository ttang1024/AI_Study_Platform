using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class GlossaryTermRepository : Repository<GlossaryTerm>, IGlossaryTermRepository
{
    public GlossaryTermRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<GlossaryTerm>> GetByUserWithSourcesAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderBy(t => t.Term)
            .ToListWithSourcesAsync(cancellationToken);

    public async Task<int> CountUnmasteredByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(t => t.UserId == userId
                && !_context.GlossaryMastered.Any(m => m.UserId == userId && m.GlossaryTermId == t.GlossaryTermId))
            .CountAsync(cancellationToken);

    public async Task<IEnumerable<GlossaryTerm>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(t => t.DocumentId == documentId)
            .OrderBy(t => t.Term)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<GlossaryTerm>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default)
    {
        var pattern = $"%{query}%";
        return await _dbSet
            .AsNoTracking()
            .Where(t => t.UserId == userId &&
                        (EF.Functions.ILike(t.Term, pattern) || EF.Functions.ILike(t.Definition, pattern)))
            .OrderBy(t => t.Term)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var terms = await _dbSet.Where(t => t.DocumentId == documentId).ToListAsync(cancellationToken);
        _dbSet.RemoveRange(terms);
    }

    public async Task<IEnumerable<GlossaryTerm>> GetByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(t => t.VideoId == videoId)
            .OrderBy(t => t.Term)
            .ToListAsync(cancellationToken);

    public async Task DeleteByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default)
    {
        var terms = await _dbSet.Where(t => t.VideoId == videoId).ToListAsync(cancellationToken);
        _dbSet.RemoveRange(terms);
    }
}
