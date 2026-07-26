using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IRubricRepository : IRepository<Rubric>
{
    Task<IEnumerable<Rubric>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IEssaySubmissionRepository : IRepository<EssaySubmission>
{
    /// <summary>Latest draft of each chain, newest first — what the list page shows.</summary>
    Task<IEnumerable<EssaySubmission>> GetLatestByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Every draft in one revision chain, oldest first.</summary>
    Task<IEnumerable<EssaySubmission>> GetRevisionChainAsync(
        Guid userId, Guid submissionId, CancellationToken cancellationToken = default);
}
