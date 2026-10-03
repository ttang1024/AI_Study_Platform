namespace StudyPlatform.Domain.Projections;

/// <summary>
/// Lightweight video row for "fetch all videos to label content" use cases
/// (glossary/flashcards/notes source labels). Deliberately omits the heavy text
/// columns (Summary, MindMapText, Transcript) so they are never read from the DB
/// or shipped over the wire.
/// </summary>
public record VideoListItem(
    Guid Id,
    Guid CourseId,
    string CourseName,
    string CourseColor,
    string VideoId,
    string VideoUrl,
    string SourceType,
    string Title,
    string ThumbnailUrl,
    DateTime CreatedAt);
