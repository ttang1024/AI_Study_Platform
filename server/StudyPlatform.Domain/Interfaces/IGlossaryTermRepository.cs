using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IGlossaryTermRepository : IRepository<GlossaryTerm>
{
    Task<IEnumerable<GlossaryTerm>> GetByUserWithSourcesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<GlossaryTerm>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<IEnumerable<GlossaryTerm>> GetByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default);
    Task DeleteByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default);
}
