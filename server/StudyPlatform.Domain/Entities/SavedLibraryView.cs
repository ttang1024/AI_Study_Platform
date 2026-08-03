namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A named set of library filters — "smart folders".
///
/// <para>Stores the query, not its results, so a saved view stays current as the library grows;
/// materialising the matches would turn a live filter into a stale list the moment anything is
/// added.</para>
/// </summary>
public class SavedLibraryView
{
    public Guid SavedLibraryViewId { get; set; }
    public Guid UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Emoji or icon key the client renders beside the name. Purely cosmetic.</summary>
    public string? Icon { get; set; }

    /// <summary>
    /// JSON <c>{ type, courseId, search, tagIds[] }</c> — the same shape the library list takes as
    /// query parameters.
    ///
    /// <para>Opaque JSON rather than a column per filter because it has to track those parameters
    /// exactly, and every new filter would otherwise be a migration. The server never queries across
    /// it; it is read whole, handed to the client, and replayed as a request.</para>
    /// </summary>
    public string FiltersJson { get; set; } = "{}";

    /// <summary>Where the view sits in the user's list. Explicit so ordering survives renames.</summary>
    public int Position { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
