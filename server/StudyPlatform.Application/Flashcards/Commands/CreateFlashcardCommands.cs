using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record CreateFlashcardCommand(
    Guid UserId,
    string Front,
    string Back,
    Guid? DocumentId = null,
    Guid? VideoId = null,
    string CardType = "basic") : IRequest<Result<FlashcardDto>>;

public class CreateFlashcardCommandHandler : IRequestHandler<CreateFlashcardCommand, Result<FlashcardDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IFlashcardRepository _flashcards;
    public CreateFlashcardCommandHandler(IUnitOfWork unitOfWork, IDocumentRepository documents, IFlashcardRepository flashcards) { _unitOfWork = unitOfWork;
    _documents = documents;
    _flashcards = flashcards; }

    public async Task<Result<FlashcardDto>> Handle(CreateFlashcardCommand request, CancellationToken cancellationToken)
    {
        if (request.DocumentId.HasValue)
        {
            var doc = await _documents.GetOwnedAsync(request.DocumentId.Value, request.UserId, cancellationToken);
            if (doc == null)
                return Result<FlashcardDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
        }

        var flashcard = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            VideoId = request.VideoId,
            SourceType = request.VideoId.HasValue ? "video" : "document",
            UserId = request.UserId,
            Front = request.Front,
            Back = request.Back,
            CardType = request.CardType,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(flashcard.ToFlashcardDto(), "Flashcard created successfully.");
    }
}
