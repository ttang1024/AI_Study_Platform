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

    Task<Video?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<Video?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Video?> GetByExternalVideoIdAsync(string externalVideoId, CancellationToken cancellationToken = default);
    Task<Video?> GetByExternalVideoIdForUserAsync(string externalVideoId, Guid userId, CancellationToken cancellationToken = default);
}
