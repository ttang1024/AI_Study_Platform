using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFlashcardRepository : IRepository<Flashcard>
{
    Task<IEnumerable<Flashcard>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Flashcard>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task DeleteByIdsAsync(IEnumerable<Guid> ids, Guid userId, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Flashcard> Items, int TotalCount)> GetPagedByUserIdAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> VideoIds)> GetCoverageByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Flashcard>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default);
}
