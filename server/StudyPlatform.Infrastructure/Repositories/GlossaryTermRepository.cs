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
            .Include(t => t.Document)
            .Include(t => t.YouTubeVideo)
            .Where(t => t.UserId == userId)
            .OrderBy(t => t.Term)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<GlossaryTerm>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(t => t.DocumentId == documentId)
            .OrderBy(t => t.Term)
            .ToListAsync(cancellationToken);

    public async Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var terms = await _dbSet.Where(t => t.DocumentId == documentId).ToListAsync(cancellationToken);
        _dbSet.RemoveRange(terms);
    }

    public async Task<IEnumerable<GlossaryTerm>> GetByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(t => t.YouTubeVideoId == videoId)
            .OrderBy(t => t.Term)
            .ToListAsync(cancellationToken);

    public async Task DeleteByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default)
    {
        var terms = await _dbSet.Where(t => t.YouTubeVideoId == videoId).ToListAsync(cancellationToken);
        _dbSet.RemoveRange(terms);
    }
}
