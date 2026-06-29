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
    Task<(IReadOnlyList<LibraryItem> Items, int TotalCount)> GetPagedAsync(
        Guid userId,
        string type,
        Guid? courseId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
