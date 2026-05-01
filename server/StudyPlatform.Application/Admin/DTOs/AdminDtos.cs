namespace StudyPlatform.Application.Admin.DTOs;

public record AdminLoginRequest(string Email, string Password);

public record AdminTokenResponse(string Token);

public record FeedbackItemDto(
    Guid Id,
    string Type,
    string Status,
    string Subject,
    string Message,
    int? Rating,
    DateTime SubmittedAt,
    Guid? UserId,
    string? UserEmail,
    string? AdminNote,
    DateTime? ResolvedAt);

public record FeedbackStatsDto(
    int Total,
    Dictionary<string, int> ByType,
    Dictionary<string, int> ByStatus,
    double? AverageRating,
    int RecentCount);

public record UserDto(
    Guid UserId,
    string Email,
    string FullName,
    bool IsEmailVerified,
    bool IsAdmin,
    bool IsActive,
    DateTime CreatedAt);
