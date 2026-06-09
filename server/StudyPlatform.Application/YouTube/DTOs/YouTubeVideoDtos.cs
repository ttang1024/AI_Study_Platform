namespace StudyPlatform.Application.YouTube.DTOs;

public record YouTubeVideoDto(
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

public record SaveYouTubeVideoRequest(
    Guid CourseId,
    string VideoId,
    string VideoUrl,
    string? SourceType,
    string Title,
    string ThumbnailUrl,
    string? Summary);

public record UpdateYouTubeVideoRequest(
    string? Title,
    string? Summary,
    string? MindMapText);

public record MoveYouTubeVideoRequest(Guid TargetCourseId);

public record YouTubeVideoPagedResult(
    IEnumerable<YouTubeVideoDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);

// Lightweight list shape — no Summary/MindMapText. Used by callers that fetch all
// of a user's videos only to label other content (glossary/flashcards/notes).
public record YouTubeVideoLiteDto(
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

public record YouTubeVideoLitePagedResult(
    IEnumerable<YouTubeVideoLiteDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
