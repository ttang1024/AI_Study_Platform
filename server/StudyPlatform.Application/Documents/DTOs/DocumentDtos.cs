namespace StudyPlatform.Application.Documents.DTOs;

public record DocumentDto(
    Guid DocumentId,
    Guid CourseId,
    Guid UserId,
    string FileName,
    string BlobUrl,
    string ContentType,
    long FileSize,
    string? Summary,
    string? MindMapText,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Transcript = null,
    string? OriginalUrl = null);

public record QuizDto(
    Guid QuizId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
    string SourceType,
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    DateTime CreatedAt,
    string Difficulty = "medium");

public record FlashcardSrsDto(
    Guid FlashcardId,
    int State,
    double Stability,
    double Difficulty,
    int Reps,
    int Lapses,
    DateTime Due,
    DateTime? LastReview,
    double Retrievability);

public record FlashcardDto(
    Guid FlashcardId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
    string SourceType,
    Guid UserId,
    string Front,
    string Back,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Title = null,
    string? Document = null,
    string? Video = null,
    FlashcardSrsDto? Srs = null,
    string CardType = "basic",
    string Difficulty = "medium",
    string? Chapter = null,
    IEnumerable<string>? Tags = null);

public record ChatMessageDto(
    Guid MessageId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
    string SourceType,
    string Role,
    string Content,
    DateTime CreatedAt);

public record AIChatRequest(string Message);

public record QuizSubmissionDto(
    Guid SubmissionId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
    string SourceType,
    Dictionary<string, string> Answers,
    int Score,
    int Total,
    DateTime SubmittedAt,
    string? Title = null,
    string? Document = null,
    string? Video = null);

public record QuizSubmissionCoverageDto(
    IEnumerable<Guid> DocumentIds,
    IEnumerable<Guid> YouTubeVideoIds);

public record PendingMaterialDto(
    string Kind,
    Guid Id,
    Guid CourseId,
    string CourseName,
    string CourseColor,
    string Name,
    string? ContentType,
    string? BlobUrl,
    string? OriginalUrl,
    string? VideoId,
    string? VideoUrl,
    string? ThumbnailUrl,
    DateTime CreatedAt,
    string? SourceType = null);

public record SaveQuizSubmissionRequest(
    Dictionary<string, string> Answers,
    int Score,
    int Total);

public record ClipUrlRequest(string Url, string CourseId);

public record MoveCourseRequest(Guid TargetCourseId);

public record UpdateDocumentRequest(string FileName);

public record GlossaryTermDto(
    Guid Id,
    Guid? DocumentId,
    string Term,
    string Definition,
    DateTime CreatedAt,
    Guid? YouTubeVideoId = null,
    Guid? CourseId = null,
    string? SourceName = null,
    string? SourceKind = null);
