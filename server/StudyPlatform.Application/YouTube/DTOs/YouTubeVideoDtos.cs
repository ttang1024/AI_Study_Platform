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
