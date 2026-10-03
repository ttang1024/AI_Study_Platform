namespace StudyPlatform.Application.Documents.DTOs;

public record DocumentDto(
    Guid DocumentId,
    Guid CourseId,
    Guid UserId,
    string FileName,
    string BlobUrl,
    string ContentType,
    long FileSize,
    string? FileHash,
    string? Summary,
    string? MindMapText,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Transcript = null,
    string? OriginalUrl = null);

public record QuizDto(
    Guid QuizId,
    Guid? DocumentId,
    Guid? VideoId,
    string SourceType,
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    DateTime CreatedAt,
    string Difficulty = "medium",
    SourceCitationDto? Citation = null);

public record FlashcardSrsDto(
    Guid FlashcardId,
    int State,
    double Stability,
    double Difficulty,
    int Reps,
    int Lapses,
    DateTime Due,
    DateTime? LastReview,
    double Retrievability,
    bool IsSuspended = false);

public record FlashcardDto(
    Guid FlashcardId,
    Guid? DocumentId,
    Guid? VideoId,
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
    IEnumerable<string>? Tags = null,
    string? ImageUrl = null,
    string? OcclusionsJson = null,
    SourceCitationDto? Citation = null);

public record ChatMessageDto(
    Guid MessageId,
    Guid? DocumentId,
    Guid? VideoId,
    string SourceType,
    string Role,
    string Content,
    DateTime CreatedAt,
    IEnumerable<ChatMessageAttachmentDto>? Attachments = null);

/// <summary>A stored chat attachment surfaced to clients. <see cref="Url"/> is a time-limited presigned GET URL.</summary>
public record ChatMessageAttachmentDto(string Url, string MimeType, string? FileName);

/// <summary>An image/PDF attachment for a chat turn. <see cref="Data"/> is raw base64 (no data: URL prefix).</summary>
public record ChatAttachmentDto(string MimeType, string Data, string? FileName);

public record AIChatRequest(string Message, IEnumerable<ChatAttachmentDto>? Attachments = null, Guid? ConversationId = null);

public record QuizSubmissionDto(
    Guid SubmissionId,
    Guid? DocumentId,
    Guid? VideoId,
    string SourceType,
    Dictionary<string, string> Answers,
    int Score,
    int Total,
    DateTime SubmittedAt,
    string? Title = null,
    string? Document = null,
    string? Video = null,
    Guid? CourseId = null);

public record QuizSubmissionCoverageDto(
    IEnumerable<Guid> DocumentIds,
    IEnumerable<Guid> VideoIds);

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

/// <param name="Confidence">
/// Optional {quizId: 1|2|3} self-rating per answer (1 = guessing, 3 = confident). Optional so existing
/// clients keep working unchanged and a learner can skip rating a question.
/// </param>
public record SaveQuizSubmissionRequest(
    Dictionary<string, string> Answers,
    int Score,
    int Total,
    Dictionary<string, int>? Confidence = null);

public record ClipUrlRequest(string Url, string CourseId);

public record MoveCourseRequest(Guid TargetCourseId);

public record UpdateDocumentRequest(string FileName);

public record UpdateDocumentContentRequest(string? Summary = null, string? MindMapText = null);

public record GlossaryTermDto(
    Guid Id,
    Guid? DocumentId,
    string Term,
    string Definition,
    DateTime CreatedAt,
    Guid? VideoId = null,
    Guid? CourseId = null,
    string? SourceName = null,
    string? SourceKind = null,
    SourceCitationDto? Citation = null);

/// <summary>
/// Where a generated artifact came from in its source material.
///
/// <para><c>StartOffset</c>/<c>EndOffset</c> are character positions in the source's extracted text
/// and are null when the supporting quote could not be located — the client then shows the quote as
/// plain attribution with no jump target. <c>Page</c> and <c>StartSeconds</c> are set only for
/// paginated documents and timed media respectively.</para>
/// </summary>
public record SourceCitationDto(
    string Quote,
    int? StartOffset = null,
    int? EndOffset = null,
    int? Page = null,
    double? StartSeconds = null);
