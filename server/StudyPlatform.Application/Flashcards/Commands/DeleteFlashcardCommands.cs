using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record DeleteFlashcardCommand(Guid FlashcardId, Guid UserId) : IRequest<Result>;

public class DeleteFlashcardCommandHandler : IRequestHandler<DeleteFlashcardCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(DeleteFlashcardCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        _unitOfWork.Flashcards.Remove(flashcard);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Flashcard deleted successfully.");
    }
}

public record BulkDeleteFlashcardsCommand(IEnumerable<Guid> FlashcardIds, Guid UserId) : IRequest<Result>;

public class BulkDeleteFlashcardsCommandHandler : IRequestHandler<BulkDeleteFlashcardsCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public BulkDeleteFlashcardsCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(BulkDeleteFlashcardsCommand request, CancellationToken cancellationToken)
    {
        await _unitOfWork.Flashcards.DeleteByIdsAsync(request.FlashcardIds, request.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Flashcards deleted successfully.");
    }
}
