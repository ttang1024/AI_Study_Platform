using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IConceptLinkRepository : IRepository<ConceptLink>
{
    Task<IEnumerable<ConceptLink>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
