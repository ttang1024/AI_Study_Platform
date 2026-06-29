namespace StudyPlatform.Domain.Projections;

/// <summary>
/// A single row in the unified Library list — either a document or a video. It
/// carries only the fields the library cards render (no Summary/MindMap/Transcript
/// blobs), so a page of items stays small over the wire. <see cref="Kind"/> is the
/// discriminator: "document" or "video". Document-only fields are null for videos
/// and vice-versa.
/// </summary>
public class LibraryItem
{
    public string Kind { get; set; } = string.Empty;
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string CourseColor { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Document fields
    public string? FileName { get; set; }
    public string? BlobUrl { get; set; }
    public string? ContentType { get; set; }
    public long FileSize { get; set; }
    public string? FileHash { get; set; }
    public string? OriginalUrl { get; set; }

    // Video fields
    public string? Title { get; set; }
    public string? VideoId { get; set; }
    public string? VideoUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? SourceType { get; set; }
}
