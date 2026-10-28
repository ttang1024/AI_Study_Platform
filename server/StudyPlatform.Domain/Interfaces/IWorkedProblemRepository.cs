using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IWorkedProblemRepository
{
    Task<IEnumerable<WorkedProblem>> GetByUserAsync(Guid userId, Guid? documentId, Guid? videoId, CancellationToken cancellationToken = default);
    Task<WorkedProblem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(WorkedProblem problem, CancellationToken cancellationToken = default);
    Task AddRangeAsync(IEnumerable<WorkedProblem> problems, CancellationToken cancellationToken = default);

    /// <summary>The ones among <paramref name="ids"/> that exist and belong to <paramref name="userId"/>.</summary>
    Task<IReadOnlySet<Guid>> GetOwnedIdsAsync(Guid userId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);
}
