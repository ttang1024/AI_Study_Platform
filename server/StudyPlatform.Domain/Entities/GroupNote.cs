namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A collaboratively edited note belonging to a study group. The canonical content is a
/// Yjs CRDT document; <see cref="State"/> holds the merged Yjs update blob so late joiners
/// can hydrate, and <see cref="ContentPreview"/> caches plain text for list views.
/// </summary>
public class GroupNote
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Merged Yjs document state (encoded update).</summary>
    public byte[] State { get; set; } = Array.Empty<byte>();

    /// <summary>Plain-text snapshot of the doc for previews/search; best effort.</summary>
    public string ContentPreview { get; set; } = string.Empty;

    public Guid CreatedBy { get; set; }
    public Guid? LastEditedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public StudyGroup? Group { get; set; }
}
