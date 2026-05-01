using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class ConceptLinkRepository : Repository<ConceptLink>, IConceptLinkRepository
{
    public ConceptLinkRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<ConceptLink>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<ConceptLink>> GetByEntityAsync(Guid userId, string entityType, Guid entityId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(l => l.UserId == userId &&
                ((l.SourceEntityType == entityType && l.SourceEntityId == entityId) ||
                 (l.TargetEntityType == entityType && l.TargetEntityId == entityId)))
            .ToListAsync(cancellationToken);
}
