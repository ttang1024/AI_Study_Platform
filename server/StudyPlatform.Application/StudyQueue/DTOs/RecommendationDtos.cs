namespace StudyPlatform.Application.StudyQueue.DTOs;

/// <summary>
/// One personalized suggestion. <c>Type</c> drives the icon/route on the client.
/// <c>Priority</c> is a 1-100 urgency score used purely for ordering.
/// </summary>
public record RecommendationItemDto(
    string Id,
    string Type,        // "flashcards" | "quiz" | "glossary" | "problems" | "material" | "course"
    string Title,
    string Reason,
    int Priority,
    string? Url,
    Guid? CourseId,
    string? CourseName,
    int? Count);

public record RecommendationsDto(
    IEnumerable<RecommendationItemDto> ReviewQueue,
    IEnumerable<RecommendationItemDto> NextBestContent,
    DateTime GeneratedAt);
