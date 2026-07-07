namespace StudyPlatform.Application.Videos.DTOs;

public record VideoDto(
    Guid Id,
    Guid CourseId,
    string CourseName,
    string CourseColor,
    string VideoId,
    string VideoUrl,
    string SourceType,
    string Title,
    string ThumbnailUrl,
    string? Summary,
    string? MindMapText,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record SaveVideoRequest(
    Guid CourseId,
    string VideoId,
    string VideoUrl,
    string? SourceType,
    string Title,
    string ThumbnailUrl,
    string? Summary);

public record UpdateVideoRequest(
    string? Title,
    string? Summary,
    string? MindMapText);

public record MoveVideoRequest(Guid TargetCourseId);

public record VideoPagedResult(
    IEnumerable<VideoDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);

// Lightweight list shape — no Summary/MindMapText. Used by callers that fetch all
// of a user's videos only to label other content (glossary/flashcards/notes).
public record VideoLiteDto(
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

public record VideoLitePagedResult(
    IEnumerable<VideoLiteDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
