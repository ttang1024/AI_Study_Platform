namespace StudyPlatform.Application.Library.DTOs;

/// <summary>
/// One entry in the unified library list. <see cref="Kind"/> is "document" or
/// "video"; the unused side's fields are null. Carries only what the library cards
/// render — no MindMap/Transcript — keeping a page small over the wire.
/// </summary>
public record LibraryItemDto(
    string Kind,
    Guid Id,
    Guid CourseId,
    string CourseName,
    string CourseColor,
    DateTime CreatedAt,
    string? FileName,
    string? BlobUrl,
    string? ContentType,
    long FileSize,
    string? FileHash,
    string? OriginalUrl,
    string? Summary,
    string? Title,
    string? VideoId,
    string? VideoUrl,
    string? ThumbnailUrl,
    string? SourceType);
