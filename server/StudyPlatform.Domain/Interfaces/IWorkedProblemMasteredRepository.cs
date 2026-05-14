using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IWorkedProblemMasteredRepository
{
    Task<IEnumerable<Guid>> GetMasteredProblemIdsByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<WorkedProblemMastered?> GetByUserAndProblemAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default);
    Task AddAsync(WorkedProblemMastered mastered, CancellationToken cancellationToken = default);
    void Remove(WorkedProblemMastered mastered);
}
