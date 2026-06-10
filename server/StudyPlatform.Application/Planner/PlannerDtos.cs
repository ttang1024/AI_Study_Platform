namespace StudyPlatform.Application.Planner;

public record ExamPlanDto(
    Guid Id,
    Guid? CourseId,
    string? CourseName,
    string Title,
    DateTime ExamDate,
    int DailyMinutes,
    int DaysRemaining,
    DateTime CreatedAt);

public record CreateExamPlanRequest(string Title, DateTime ExamDate, Guid? CourseId, int DailyMinutes);

public record PlanTaskDto(string Type, string Title, string Reason, int Minutes, string? Url);

public record PlanDayDto(DateTime Date, string Label, int Minutes, IReadOnlyList<PlanTaskDto> Tasks);

public record ExamScheduleDto(ExamPlanDto Plan, IReadOnlyList<PlanDayDto> Days);

public record MockExamQuestionDto(Guid QuizId, string Question, IReadOnlyList<string> Options);

public record MockExamDto(Guid? CourseId, IReadOnlyList<MockExamQuestionDto> Questions, int SuggestedMinutes);

public record GradeMockExamRequest(Dictionary<string, string> Answers, int DurationSeconds);

public record MockExamResultItemDto(Guid QuizId, string Question, string CorrectAnswer, string UserAnswer, bool Correct, string Explanation);

public record MockExamResultDto(int Score, int Total, IReadOnlyList<MockExamResultItemDto> Items);
