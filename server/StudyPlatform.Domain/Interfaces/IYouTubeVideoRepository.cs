using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IYouTubeVideoRepository : IRepository<YouTubeVideo>
{
    Task<(IEnumerable<YouTubeVideo> Items, int TotalCount)> GetPagedAsync(
        Guid userId, Guid? courseId, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default);

    Task<YouTubeVideo?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByVideoIdAsync(string videoId, CancellationToken cancellationToken = default);
    Task<YouTubeVideo?> GetByVideoIdForUserAsync(string videoId, Guid userId, CancellationToken cancellationToken = default);
}
