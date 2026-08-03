using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IAuditLogRepository : IRepository<AuditLogEntry>
{
    /// <summary>
    /// Newest-first page of entries where the user is the actor or the subject.
    ///
    /// <para>Both sides, because the entries a user most needs to see are the ones where somebody
    /// else acted on their account — filtering to actor only would hide exactly those.</para>
    /// </summary>
    Task<(IReadOnlyList<AuditLogEntry> Items, int Total)> GetForUserAsync(
        Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Cross-user read for the admin console. Optional filters narrow by actor and action key.</summary>
    Task<(IReadOnlyList<AuditLogEntry> Items, int Total)> GetAllAsync(
        Guid? actorUserId, string? action, int page, int pageSize, CancellationToken cancellationToken = default);
}
