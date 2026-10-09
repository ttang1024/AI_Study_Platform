using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IWorkedProblemAttemptRepository
{
    Task AddAsync(WorkedProblemAttempt attempt, CancellationToken cancellationToken = default);
}
