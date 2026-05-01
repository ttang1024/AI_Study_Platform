namespace StudyPlatform.Application.Analytics.DTOs;

public record DailyStudyDurationDto(DateTime Date, int TotalSeconds, int TotalMinutes);

public record DailyQuizAccuracyDto(DateTime Date, int TotalAttempts, int CorrectAttempts, double AccuracyPercentage);

public record DailyDocumentsStudiedDto(DateTime Date, int DocumentCount, IEnumerable<string> DocumentNames);

public record RecordQuizAttemptRequest(Guid QuizId, bool IsCorrect);
