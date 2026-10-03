using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Reads the unified library list (documents + videos merged) with server-side
/// filtering and pagination, so callers fetch only one page at a time instead of
/// pulling every document and every video up front.
/// </summary>
public interface ILibraryRepository
{
    /// <param name="type">all | documents | articles | audio | videos.</param>
    /// <param name="tagIds">
    /// When non-empty, keeps only items carrying at least one of these tags. Any-match rather than
    /// all-match: selecting two tags in a filter bar reads as "either of these", and all-match makes
    /// a second click almost always empty the list.
    /// </param>
    Task<(IReadOnlyList<LibraryItem> Items, int TotalCount)> GetPagedAsync(
        Guid userId,
        string type,
        Guid? courseId,
        string? search,
        int page,
        int pageSize,
        IReadOnlyCollection<Guid>? tagIds = null,
        CancellationToken cancellationToken = default);
}
