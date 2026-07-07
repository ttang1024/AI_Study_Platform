namespace StudyPlatform.Application.WorkedProblems.DTOs;

public record ProblemStepDto(int StepNumber, string Description, string? Formula);

public record WorkedProblemDto(
    Guid WorkedProblemId,
    Guid UserId,
    Guid? DocumentId,
    Guid? VideoId,
    string ProblemText,
    IEnumerable<ProblemStepDto> Steps,
    string FinalAnswer,
    string Difficulty,
    string? Topic,
    DateTime CreatedAt);

public record WorkedProblemAttemptDto(
    Guid WorkedProblemAttemptId,
    Guid WorkedProblemId,
    string UserAnswer,
    string? AiEvaluation,
    bool? IsCorrect,
    DateTime AttemptedAt);
