using System.Text.Json;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.QuestionBank;

public record RecordQuestionBankAttemptCommand(Guid UserId, Guid QuizId, string SelectedAnswer)
    : IRequest<Result<QuestionBankAttemptResultDto>>;

public class RecordQuestionBankAttemptCommandHandler
    : IRequestHandler<RecordQuestionBankAttemptCommand, Result<QuestionBankAttemptResultDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public RecordQuestionBankAttemptCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuestionBankAttemptResultDto>> Handle(RecordQuestionBankAttemptCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SelectedAnswer))
            return Result<QuestionBankAttemptResultDto>.Failure("An answer is required.", "INVALID_ANSWER");

        var quiz = await _unitOfWork.Quizzes.GetByIdAsync(request.QuizId, cancellationToken);
        if (quiz == null || quiz.UserId != request.UserId)
            return Result<QuestionBankAttemptResultDto>.Failure("Question not found.", "QUESTION_NOT_FOUND");

        // Same upsert as quiz submissions: a wrong pick creates or bumps an open
        // mistake-notebook entry; a correct one resolves a previously-open entry.
        await MistakeCapture.CaptureForQuizzesAsync(
            _unitOfWork,
            request.UserId,
            new[] { quiz },
            new Dictionary<string, string> { [quiz.QuizId.ToString()] = request.SelectedAnswer },
            cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<QuestionBankAttemptResultDto>.Success(
            new QuestionBankAttemptResultDto(QuizAnswerComparer.IsCorrect(request.SelectedAnswer, quiz.CorrectAnswer)));
    }
}
