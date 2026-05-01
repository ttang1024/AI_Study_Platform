using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IWorkedProblemAttemptRepository
{
    Task<IEnumerable<WorkedProblemAttempt>> GetByProblemAsync(Guid problemId, Guid userId, CancellationToken cancellationToken = default);
    Task AddAsync(WorkedProblemAttempt attempt, CancellationToken cancellationToken = default);
}
