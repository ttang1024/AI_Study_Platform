using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IQuizRepository : IRepository<Quiz>
{
    Task<IEnumerable<Quiz>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Quiz>> GetByDocumentIdAndDifficultyAsync(Guid documentId, string difficulty, CancellationToken cancellationToken = default);
    Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
}
