namespace StudyPlatform.Application.Share.DTOs;

public record CreateShareRequest(
    string Title,
    string? Summary,
    string? MindMapText,
    string? NotesHtml,
    string? QuizzesJson,
    string? FlashcardsJson,
    string? GlossaryJson,
    int? ExpiresInDays,
    string? SourceType,
    string? SourceUrl,
    string? OriginalArticleUrl = null
);

public record CreateShareResponse(string Token, string ShareUrl);

public record ShareDto(
    string Token,
    string Title,
    string OwnerName,
    string? Summary,
    string? MindMapText,
    string? NotesHtml,
    object? Quizzes,
    object? Flashcards,
    object? Glossary,
    string CreatedAt,
    string? ExpiresAt,
    string? SourceType,
    string? SourceUrl,
    string? OriginalArticleUrl = null,
    string? FileType = null
);
