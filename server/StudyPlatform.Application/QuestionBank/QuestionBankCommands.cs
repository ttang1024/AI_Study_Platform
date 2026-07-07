using System.Text.Json;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.QuestionBank;

public record UpdateQuestionBankQuestionCommand(
    Guid UserId,
    Guid QuizId,
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    string Difficulty) : IRequest<Result<QuestionBankQuestionDto>>;

public record DeleteQuestionBankQuestionCommand(Guid UserId, Guid QuizId) : IRequest<Result>;

public class UpdateQuestionBankQuestionCommandHandler : IRequestHandler<UpdateQuestionBankQuestionCommand, Result<QuestionBankQuestionDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateQuestionBankQuestionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuestionBankQuestionDto>> Handle(UpdateQuestionBankQuestionCommand request, CancellationToken cancellationToken)
    {
        var quiz = await _unitOfWork.Quizzes.GetByIdAsync(request.QuizId, cancellationToken);
        if (quiz == null || quiz.UserId != request.UserId)
            return Result<QuestionBankQuestionDto>.Failure("Question not found.", "QUESTION_NOT_FOUND");

        var options = request.Options
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim())
            .Take(8)
            .ToArray();
        if (string.IsNullOrWhiteSpace(request.Question))
            return Result<QuestionBankQuestionDto>.Failure("Question is required.", "INVALID_QUESTION");
        if (options.Length == 0)
            return Result<QuestionBankQuestionDto>.Failure("At least one answer option is required.", "INVALID_OPTIONS");

        quiz.Question = request.Question.Trim();
        quiz.OptionsJson = JsonSerializer.Serialize(options);
        quiz.CorrectAnswer = NormalizeCorrectAnswer(options, request.CorrectAnswer);
        quiz.Explanation = request.Explanation.Trim();
        quiz.Difficulty = QuizDifficulty.Normalize(request.Difficulty);
        _unitOfWork.Quizzes.Update(quiz);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == request.UserId, cancellationToken))
            .ToDictionary(d => d.DocumentId);
        var videos = (await _unitOfWork.Videos.FindAsync(v => v.UserId == request.UserId, cancellationToken))
            .ToDictionary(v => v.VideoId);
        var courses = (await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken))
            .ToDictionary(c => c.CourseId);

        return Result<QuestionBankQuestionDto>.Success(
            GetQuestionBankQueryHandler.ToDto(quiz, documents, videos, courses),
            "Question updated.");
    }

    private static string NormalizeCorrectAnswer(string[] options, string correctAnswer)
    {
        var trimmed = correctAnswer.Trim();
        if (Regex.IsMatch(trimmed, "^[A-H]$", RegexOptions.IgnoreCase))
            return trimmed.ToUpperInvariant();

        for (var i = 0; i < options.Length && i < 8; i++)
        {
            if (AnswersMatch(options[i], trimmed))
                return ((char)('A' + i)).ToString();
        }

        return trimmed.Length <= 10 ? trimmed : "A";
    }

    private static bool AnswersMatch(string option, string answer)
        => string.Equals(NormalizeMeaning(option), NormalizeMeaning(answer), StringComparison.OrdinalIgnoreCase);

    private static string NormalizeMeaning(string value)
    {
        var stripped = Regex.Replace(value.Trim(), "^[A-H][).:\\s]+", string.Empty, RegexOptions.IgnoreCase).ToLowerInvariant();
        var alphanumeric = Regex.Replace(stripped.Replace("&", " and "), "[^a-z0-9]+", " ");
        return Regex.Replace(alphanumeric, "\\s+", " ").Trim();
    }
}

public class DeleteQuestionBankQuestionCommandHandler : IRequestHandler<DeleteQuestionBankQuestionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteQuestionBankQuestionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(DeleteQuestionBankQuestionCommand request, CancellationToken cancellationToken)
    {
        var quiz = await _unitOfWork.Quizzes.GetByIdAsync(request.QuizId, cancellationToken);
        if (quiz == null || quiz.UserId != request.UserId)
            return Result.Failure("Question not found.", "QUESTION_NOT_FOUND");

        _unitOfWork.Quizzes.Remove(quiz);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Question deleted.");
    }
}
