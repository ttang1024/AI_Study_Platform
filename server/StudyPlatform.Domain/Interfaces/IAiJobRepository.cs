using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IAiJobRepository : IRepository<AiJob>
{
    /// <summary>The queued-or-running job for this artifact, if one is already in flight.</summary>
    Task<AiJob?> GetActiveAsync(Guid userId, Guid documentId, string jobType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Fails every job left queued or running. Called at startup: the queue is in-process, so a restart
    /// loses its entries, and a job stuck at "running" forever is worse than one the user can retry.
    /// </summary>
    Task<int> FailInterruptedAsync(string reason, CancellationToken cancellationToken = default);
}
