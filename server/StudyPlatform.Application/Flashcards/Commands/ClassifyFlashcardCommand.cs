using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record ClassifyFlashcardCommand(
    Guid FlashcardId,
    Guid UserId,
    string? Front,
    string? Back,
    string? Difficulty,
    string? Chapter,
    IEnumerable<string>? Tags) : IRequest<Result<FlashcardDto>>;

public class ClassifyFlashcardCommandHandler : IRequestHandler<ClassifyFlashcardCommand, Result<FlashcardDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public ClassifyFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardDto>> Handle(ClassifyFlashcardCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result<FlashcardDto>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(request.Front))
            flashcard.Front = request.Front.Trim();

        if (!string.IsNullOrWhiteSpace(request.Back))
            flashcard.Back = request.Back.Trim();

        if (request.Difficulty is not null)
            flashcard.Difficulty = request.Difficulty;

        if (request.Chapter is not null)
            flashcard.Chapter = string.IsNullOrWhiteSpace(request.Chapter) ? null : request.Chapter.Trim();

        if (request.Tags is not null)
            flashcard.Tags = request.Tags
                .Select(t => t.Trim().ToLowerInvariant())
                .Where(t => t.Length > 0)
                .Distinct()
                .ToList();

        flashcard.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(flashcard.ToFlashcardDto());
    }
}
