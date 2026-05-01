using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IConceptLinkRepository : IRepository<ConceptLink>
{
    Task<IEnumerable<ConceptLink>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ConceptLink>> GetByEntityAsync(Guid userId, string entityType, Guid entityId, CancellationToken cancellationToken = default);
}
