using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>A tag with how many live library items carry it.</summary>
public record LibraryTagWithCount(LibraryTag Tag, int ItemCount);

public interface ILibraryTagRepository : IRepository<LibraryTag>
{
    /// <summary>
    /// The user's tags of one kind, with item counts. Counts exclude assignments whose item has been
    /// deleted, so a folder never advertises contents that are no longer there.
    /// </summary>
    Task<IReadOnlyList<LibraryTagWithCount>> GetForUserAsync(
        Guid userId, string? kind, CancellationToken cancellationToken = default);

    Task<LibraryTag?> GetByNameAsync(
        Guid userId, string name, string kind, CancellationToken cancellationToken = default);

    /// <summary>The tags on each of the given items, keyed by <c>(kind, id)</c>. One query for a whole page.</summary>
    Task<IReadOnlyDictionary<(string ItemKind, Guid ItemId), List<LibraryTag>>> GetAssignmentsAsync(
        Guid userId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds assignments, ignoring ones that already exist. Returns how many were newly created so
    /// the caller can report "added to 3 of 5" rather than claiming all five were new.
    /// </summary>
    Task<int> AssignAsync(
        Guid tagId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default);

    Task<int> UnassignAsync(
        Guid tagId,
        IReadOnlyCollection<(string ItemKind, Guid ItemId)> items,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Drops every assignment pointing at an item. Called when a document or video is deleted, since
    /// the polymorphic join has no foreign key to cascade from.
    /// </summary>
    Task RemoveAssignmentsForItemAsync(
        string itemKind, Guid itemId, CancellationToken cancellationToken = default);
}

public interface ISavedLibraryViewRepository : IRepository<SavedLibraryView>
{
    Task<IReadOnlyList<SavedLibraryView>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
