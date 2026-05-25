using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IDocumentRepository : IRepository<Document>
{
    Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, CancellationToken cancellationToken = default);
    Task<Document?> GetByIdWithDetailsAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<bool> BelongsToUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Document>> GetByUserIdAsync(Guid userId, DateTime date, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Document> Items, int TotalCount)> GetAllByUserIdAsync(Guid userId, int page, int pageSize, Guid? courseId, CancellationToken cancellationToken = default);
    Task<Document?> GetByUserIdAndFileHashAsync(Guid userId, string fileHash, CancellationToken cancellationToken = default);
    Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
