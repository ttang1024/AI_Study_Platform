using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Domain.Interfaces;

public interface IVideoRepository : IRepository<Video>
{
    Task<(IEnumerable<Video> Items, int TotalCount)> GetPagedAsync(
        Guid userId, Guid? courseId, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Paged list projected to lightweight rows (no heavy text columns). Used by the
    /// "all videos for labeling" callers that only need id/title/course/url.
    /// </summary>
    Task<(IEnumerable<VideoListItem> Items, int TotalCount)> GetPagedLiteAsync(
        Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Video count per course for a user, in one grouped query.</summary>
    Task<IReadOnlyDictionary<Guid, int>> GetCountsByCourseAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Maps every one of a user's videos to the course it belongs to, without materialising the rows —
    /// videos carry transcripts, and callers that only need the attribution should not pay for those.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Guid>> GetVideoCourseMapAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Every one of a user's videos as knowledge-graph nodes — labels and flags only, no transcript.</summary>
    Task<IReadOnlyList<VideoGraphNode>> GetGraphNodesAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<Video?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<Video?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Video?> GetByExternalVideoIdAsync(string externalVideoId, CancellationToken cancellationToken = default);
}
