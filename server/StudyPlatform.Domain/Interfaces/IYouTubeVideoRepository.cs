using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Domain.Interfaces;

public interface IYouTubeVideoRepository : IRepository<YouTubeVideo>
{
    Task<(IEnumerable<YouTubeVideo> Items, int TotalCount)> GetPagedAsync(
        Guid userId, Guid? courseId, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Paged list projected to lightweight rows (no heavy text columns). Used by the
    /// "all videos for labeling" callers that only need id/title/course/url.
    /// </summary>
    Task<(IEnumerable<YouTubeVideoListItem> Items, int TotalCount)> GetPagedLiteAsync(
        Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<YouTubeVideo?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByVideoIdAsync(string videoId, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByVideoIdForUserAsync(string videoId, Guid userId, CancellationToken cancellationToken = default);
}
