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
    public CreateFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardDto>> Handle(CreateFlashcardCommand request, CancellationToken cancellationToken)
    {
        if (request.DocumentId.HasValue)
        {
            var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId.Value, cancellationToken);
            if (doc == null || doc.UserId != request.UserId)
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

        await _unitOfWork.Flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(flashcard.ToFlashcardDto(), "Flashcard created successfully.");
    }
}
