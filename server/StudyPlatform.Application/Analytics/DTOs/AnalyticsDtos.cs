namespace StudyPlatform.Application.Analytics.DTOs;

public record DailyStudyDurationDto(DateTime Date, int TotalSeconds, int TotalMinutes);

public record DailyQuizAccuracyDto(DateTime Date, int TotalAttempts, int CorrectAttempts, double AccuracyPercentage);

public record DailyDocumentsStudiedDto(DateTime Date, int DocumentCount, IEnumerable<string> DocumentNames);

public record RecordStudySessionRequest(Guid? CourseId, string ContextType, Guid? ContextId, int DurationSeconds);

public record CourseTimeDto(Guid? CourseId, string CourseName, string? CourseColor, int TotalSeconds);

public record TimeOnTaskDto(int TotalSeconds, IEnumerable<DailyStudyDurationDto> Daily, IEnumerable<CourseTimeDto> ByCourse);

/// <summary>One contributing signal toward a course's mastery score (0-100), with the sample size it was computed from.</summary>
public record CourseMasteryComponentDto(string Label, double Score, int Sample);

public record CourseMasteryDto(Guid CourseId, string CourseName, string CourseColor, double MasteryScore, IEnumerable<CourseMasteryComponentDto> Components);

/// <summary>Consecutive-day study streak plus today's accumulated time, for the dashboard "today" strip.</summary>
public record StudyStreakDto(int CurrentStreak, int LongestStreak, int TodaySeconds, int TodayMinutes);

/// <summary>The three reinforcement-center counts, computed server-side so the dashboard doesn't have to pull every submission/flashcard/term to the browser.</summary>
public record ReinforcementCountsDto(int QuizMistakes, int UnmasteredTerms, int HardFlashcards);

/// <summary>Everything the dashboard's at-a-glance widgets need in a single round-trip.</summary>
public record DashboardSummaryDto(StudyStreakDto Streak, int DueFlashcards, ReinforcementCountsDto Reinforcement, int DailyGoalMinutes);

public record UpdateDailyGoalRequest(int Minutes);
