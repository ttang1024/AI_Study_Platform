using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IDocumentAnnotationRepository : IRepository<DocumentAnnotation>
{
    Task<IEnumerable<DocumentAnnotation>> GetByDocumentAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
}
