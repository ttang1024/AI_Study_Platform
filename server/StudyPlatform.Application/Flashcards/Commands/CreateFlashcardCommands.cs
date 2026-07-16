using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
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

/// <summary>
/// "Highlight → flashcard": mint a card from arbitrary selected text (web clipper,
/// browser extension). The selection becomes the front; the AI writes the back.
/// </summary>
public record CreateFlashcardFromTextCommand(
    Guid UserId,
    string Text,
    string? SourceTitle = null,
    string? SourceUrl = null) : IRequest<Result<FlashcardDto>>;

public class CreateFlashcardFromTextCommandHandler : IRequestHandler<CreateFlashcardFromTextCommand, Result<FlashcardDto>>
{
    private const int MaxFrontChars = 500;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;

    public CreateFlashcardFromTextCommandHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    public async Task<Result<FlashcardDto>> Handle(CreateFlashcardFromTextCommand request, CancellationToken cancellationToken)
    {
        var front = (request.Text ?? string.Empty).Trim();
        if (front.Length == 0)
            return Result<FlashcardDto>.Failure("Text is required.", "TEXT_REQUIRED");
        if (front.Length > MaxFrontChars)
            front = front[..MaxFrontChars].TrimEnd() + "…";

        var back = (await _aiService.GenerateFlashcardBackAsync(front, cancellationToken)).Trim();
        if (!string.IsNullOrWhiteSpace(request.SourceTitle))
            back += $"\n\n— {request.SourceTitle.Trim()}";

        var tags = new List<string> { "web" };
        if (!string.IsNullOrWhiteSpace(request.SourceUrl)
            && Uri.TryCreate(request.SourceUrl, UriKind.Absolute, out var uri))
            tags.Add(uri.Host);

        var flashcard = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            SourceType = "document",
            UserId = request.UserId,
            Front = front,
            Back = back,
            Tags = tags,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(flashcard.ToFlashcardDto(), "Flashcard created from selection.");
    }
}
