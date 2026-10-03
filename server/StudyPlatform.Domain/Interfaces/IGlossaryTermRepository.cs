using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IGlossaryTermRepository : IRepository<GlossaryTerm>
{
    Task<IEnumerable<GlossaryTerm>> GetByUserWithSourcesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<GlossaryTerm>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<IEnumerable<GlossaryTerm>> GetByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default);
    Task DeleteByVideoIdAsync(Guid videoId, CancellationToken cancellationToken = default);
    Task<IEnumerable<GlossaryTerm>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Terms the user has not marked mastered, counted with an anti-join. The alternative is shipping every
    /// term and every mastered id to the app just to subtract two sets and render one number.
    /// </summary>
    Task<int> CountUnmasteredByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
