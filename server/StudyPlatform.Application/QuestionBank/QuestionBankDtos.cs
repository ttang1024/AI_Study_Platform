namespace StudyPlatform.Application.QuestionBank;

public record QuestionBankQuestionDto(
    Guid QuizId,
    Guid? DocumentId,
    Guid? VideoId,
    Guid? CourseId,
    string SourceType,
    string? SourceName,
    string? CourseName,
    string? CourseColor,
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    string Difficulty,
    DateTime CreatedAt);

public record UpdateQuestionBankQuestionRequest(
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    string Difficulty);

public record RecordQuestionBankAttemptRequest(string SelectedAnswer);

public record QuestionBankAttemptResultDto(bool IsCorrect);
