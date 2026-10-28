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

    /// <summary>
    /// Title/summary matches for global search. Deliberately excludes the transcript: it is the largest
    /// column in the schema and an unanchored ILIKE over it would scan every one of the user's videos.
    /// Transcript content is reachable through the embedding index instead.
    /// </summary>
    Task<IEnumerable<Video>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default);

    Task<Video?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken cancellationToken = default);
    Task<Video?> GetByIdWithCourseAsync(Guid id, CancellationToken cancellationToken = default);
    /// <summary>Uploaded videos with a background transcription in flight, across all users (worker recovery only).</summary>
    Task<IReadOnlyList<PendingVideoTranscription>> GetPendingTranscriptionsAsync(CancellationToken cancellationToken = default);

    Task<Video?> GetByExternalVideoIdAsync(string externalVideoId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Writes only the generated column (and UpdatedAt). Saving the whole entity loaded when a stream
    /// began overwrote whatever else changed meanwhile — a mind map finishing after a summary wrote the
    /// summary column back to its pre-stream value.
    /// </summary>
    Task SaveSummaryAsync(Guid id, string summary, CancellationToken cancellationToken = default);

    /// <inheritdoc cref="SaveSummaryAsync"/>
    Task SaveMindMapAsync(Guid id, string mindMapText, CancellationToken cancellationToken = default);

    /// <summary>The stored files (video and cover) of the course's uploaded videos — the rows go by cascade.</summary>
    Task<IReadOnlyList<string>> GetUploadedFileUrlsByCourseAsync(Guid courseId, CancellationToken cancellationToken = default);

    /// <summary>Every one of the user's items as (id, course, name) — no text columns (see <see cref="SourceCourse"/>).</summary>
    Task<IReadOnlyList<SourceCourse>> GetSourceCoursesByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Inserts and commits an uploaded video unless the user already has <paramref name="limit"/> uploads
    /// (negative: unlimited). Count and insert run in one transaction under a per-user lock, so parallel
    /// uploads cannot all pass the count. Commits on its own, not through the unit of work.
    /// </summary>
    Task<bool> AddUploadWithinLimitAsync(Video video, int limit, CancellationToken cancellationToken = default);
}
