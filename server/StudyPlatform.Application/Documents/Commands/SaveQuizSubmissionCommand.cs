using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record SaveQuizSubmissionCommand(
    Guid DocumentId,
    Guid UserId,
    Dictionary<string, string> Answers,
    int Score,
    int Total) : IRequest<Result<QuizSubmissionDto>>;

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

        if (existing != null)
        {
            existing.AnswersJson = answersJson;
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
                Score = request.Score,
                Total = request.Total,
                SubmittedAt = DateTime.UtcNow,
            };
            await _unitOfWork.QuizSubmissions.AddAsync(existing, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new QuizSubmissionDto(
            existing.SubmissionId,
            existing.DocumentId,
            existing.YouTubeVideoId,
            existing.SourceType,
            request.Answers,
            existing.Score,
            existing.Total,
            existing.SubmittedAt);

        return Result<QuizSubmissionDto>.Success(dto, "Quiz submission saved.");
    }
}
