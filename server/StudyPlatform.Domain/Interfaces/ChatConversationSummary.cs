namespace StudyPlatform.Domain.Interfaces;

public record ChatConversationSummary(
    string SourceType,
    Guid SourceId,
    string SourceName,
    Guid? CourseId,
    Guid ConversationId,
    string ConversationTitle,
    string LastMessage,
    string LastMessageRole,
    DateTime UpdatedAt,
    int MessageCount);

/// <summary>One chat thread of a video or document, for thread-switcher lists.</summary>
public record ChatThreadSummary(
    Guid ConversationId,
    string Title,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int MessageCount,
    string? LastMessage);
