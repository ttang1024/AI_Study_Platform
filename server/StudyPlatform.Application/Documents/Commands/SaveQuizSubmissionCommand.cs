using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

/// <param name="Confidence">
/// Optional {quizId: 1|2|3} self-rating per answer. Absent when the learner skipped the rating or the
/// client does not collect it, which is why it is stored separately rather than folded into Answers.
/// </param>
public record SaveQuizSubmissionCommand(
    Guid DocumentId,
    Guid UserId,
    Dictionary<string, string> Answers,
    int Score,
    int Total,
    Dictionary<string, int>? Confidence = null) : IRequest<Result<QuizSubmissionDto>>;

public class SaveQuizSubmissionCommandHandler : IRequestHandler<SaveQuizSubmissionCommand, Result<QuizSubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SaveQuizSubmissionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuizSubmissionDto>> Handle(SaveQuizSubmissionCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<QuizSubmissionDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var existing = await _unitOfWork.QuizSubmissions.GetByDocumentAndUserAsync(request.DocumentId, request.UserId, cancellationToken);

        var answersJson = JsonSerializer.Serialize(request.Answers);
        var confidenceJson = ConfidenceSerializer.Serialize(request.Confidence);

        if (existing != null)
        {
            existing.AnswersJson = answersJson;
            existing.ConfidenceJson = confidenceJson;
            existing.Score = request.Score;
            existing.Total = request.Total;
            existing.SubmittedAt = DateTime.UtcNow;
            _unitOfWork.QuizSubmissions.Update(existing);
        }
        else
        {
            existing = new QuizSubmission
            {
                SubmissionId = Guid.NewGuid(),
                DocumentId = request.DocumentId,
                SourceType = "document",
                UserId = request.UserId,
                AnswersJson = answersJson,
                ConfidenceJson = confidenceJson,
                Score = request.Score,
                Total = request.Total,
                SubmittedAt = DateTime.UtcNow,
            };
            await _unitOfWork.QuizSubmissions.AddAsync(existing, cancellationToken);
        }

        await MistakeCapture.CaptureAsync(
            _unitOfWork, request.UserId, "document", request.DocumentId, null, request.Answers, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = existing.ToQuizSubmissionDto();

        return Result<QuizSubmissionDto>.Success(dto, "Quiz submission saved.");
    }
}
