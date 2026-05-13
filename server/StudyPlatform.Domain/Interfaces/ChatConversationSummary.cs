namespace StudyPlatform.Domain.Interfaces;

public record ChatConversationSummary(
    string SourceType,
    Guid SourceId,
    string SourceName,
    Guid? CourseId,
    string LastMessage,
    string LastMessageRole,
    DateTime UpdatedAt,
    int MessageCount);
