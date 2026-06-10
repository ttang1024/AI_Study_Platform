namespace StudyPlatform.Application.Mistakes;

public record MistakeDto(
    Guid Id,
    Guid? QuizId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
    string SourceType,
    string Question,
    IReadOnlyList<string> Options,
    string CorrectAnswer,
    string UserAnswer,
    string Explanation,
    string Status,
    int TimesMissed,
    DateTime FirstMissedAt,
    DateTime LastMissedAt,
    DateTime? ResolvedAt);

public record MistakesDto(IReadOnlyList<MistakeDto> Items, int OpenCount, int ResolvedCount);

public record VariantQuestionDto(
    string Question,
    IReadOnlyList<string> Options,
    string CorrectAnswer,
    string Explanation);
