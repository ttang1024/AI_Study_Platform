namespace StudyPlatform.Application.LibraryTags.DTOs;

/// <summary>
/// A tag or collection with how many live items carry it. <c>Kind</c> is what the client branches
/// on to draw a chip or a folder.
/// </summary>
public record LibraryTagDto(
    Guid LibraryTagId,
    string Name,
    string Kind,
    string? Color,
    string? Description,
    int ItemCount,
    DateTime CreatedAt);

public record CreateLibraryTagRequest(string Name, string Kind, string? Color, string? Description);

public record UpdateLibraryTagRequest(string Name, string? Color, string? Description);

/// <summary>One library item, addressed the way the polymorphic join stores it.</summary>
public record LibraryItemRef(string ItemKind, Guid ItemId);

/// <summary>
/// Bulk assign or unassign. Takes a list because the whole point is acting on a multi-select in the
/// library, and a per-item endpoint would mean one round trip per checkbox.
/// </summary>
public record AssignLibraryTagRequest(IReadOnlyList<LibraryItemRef> Items);

public record BulkTagResultDto(int Changed, int Requested);

public record SavedLibraryViewDto(
    Guid SavedLibraryViewId,
    string Name,
    string? Icon,
    string FiltersJson,
    int Position,
    DateTime CreatedAt);

public record SaveLibraryViewRequest(string Name, string? Icon, string FiltersJson, int? Position);
