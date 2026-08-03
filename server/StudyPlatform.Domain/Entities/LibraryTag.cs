namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A user-defined label on library items — the storage behind both tags and collections.
///
/// <para>One entity for both because they are the same relation: a named, user-owned grouping that
/// an item can belong to, alongside others. The only differences are presentational — collections
/// carry a description and are drawn as folders, tags are drawn as chips — and modelling them as two
/// tables would mean two sets of CRUD, two join tables, and two bulk-assign paths to keep in step,
/// all to express one idea twice. <see cref="Kind"/> is what the UI branches on.</para>
/// </summary>
public class LibraryTag
{
    public Guid LibraryTagId { get; set; }
    public Guid UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary><see cref="LibraryTagKinds.Tag"/> or <see cref="LibraryTagKinds.Collection"/>.</summary>
    public string Kind { get; set; } = LibraryTagKinds.Tag;

    /// <summary>Hex colour for the chip or folder. Null lets the client pick from its own palette.</summary>
    public string? Color { get; set; }

    /// <summary>Only meaningful for collections; tags are named, not described.</summary>
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<LibraryTagAssignment> Assignments { get; set; } = new List<LibraryTagAssignment>();
}

public static class LibraryTagKinds
{
    public const string Tag = "tag";
    public const string Collection = "collection";

    public static bool IsValid(string? kind) => kind is Tag or Collection;
}

/// <summary>
/// Ties a tag to one library item.
///
/// <para>Deliberately polymorphic: <see cref="ItemKind"/> plus <see cref="ItemId"/> points at either
/// a document or a video, with no foreign key to either. The library is already a union of those two
/// tables, and a schema that could only tag one of them would be useless — the alternative, a
/// nullable FK column per item type, adds a column and a check constraint for every future item kind
/// and still cannot be joined generically.</para>
///
/// <para>The cost is that deleting an item leaves its assignments behind, since no cascade can reach
/// them. They are pruned explicitly on delete, and reads join against live items anyway, so a
/// stray row is invisible rather than wrong.</para>
/// </summary>
public class LibraryTagAssignment
{
    public Guid LibraryTagId { get; set; }

    /// <summary><c>document</c> or <c>video</c>, matching the library list's <c>Kind</c>.</summary>
    public string ItemKind { get; set; } = string.Empty;

    public Guid ItemId { get; set; }

    public DateTime AssignedAt { get; set; }

    public LibraryTag Tag { get; set; } = null!;
}
