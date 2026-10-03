using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IDataExportRequestRepository : IRepository<DataExportRequest>
{
    Task<IReadOnlyList<DataExportRequest>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>The user's in-flight request, if any. Non-null means a new request must be refused.</summary>
    Task<DataExportRequest?> GetActiveForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
