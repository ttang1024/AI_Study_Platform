using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
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
    private readonly IDocumentRepository _documents;
    private readonly IQuizSubmissionWriter _submissions;

    public SaveQuizSubmissionCommandHandler(IDocumentRepository documents, IQuizSubmissionWriter submissions)
    {
        _documents = documents;
        _submissions = submissions;
    }

    public async Task<Result<QuizSubmissionDto>> Handle(SaveQuizSubmissionCommand request, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (document == null)
            return Result<QuizSubmissionDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var dto = await _submissions.UpsertAsync(
            request.UserId, QuizSource.Document(request.DocumentId),
            request.Answers, request.Score, request.Total, request.Confidence, cancellationToken);

        return Result<QuizSubmissionDto>.Success(dto, "Quiz submission saved.");
    }
}
