namespace StudyPlatform.Application.QuestionBank;

public record QuestionBankQuestionDto(
    Guid QuizId,
    Guid? DocumentId,
    Guid? YouTubeVideoId,
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
