using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface INoteRepository : IRepository<Note>
{
    Task<IEnumerable<Note>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Note>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task DeleteByIdsAsync(IEnumerable<Guid> ids, Guid userId, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Note> Items, int TotalCount)> GetPagedByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IEnumerable<Note>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default);
}
