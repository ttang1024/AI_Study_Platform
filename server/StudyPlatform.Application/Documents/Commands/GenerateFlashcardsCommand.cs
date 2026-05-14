using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record GenerateFlashcardsCommand(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<FlashcardDto>>>;

public class GenerateFlashcardsCommandHandler : IRequestHandler<GenerateFlashcardsCommand, Result<IEnumerable<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IDocumentTextExtractor _textExtractor;

    public GenerateFlashcardsCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IBlobStorageService blobStorageService,
        IDocumentTextExtractor textExtractor)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _blobStorageService = blobStorageService;
        _textExtractor = textExtractor;
    }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GenerateFlashcardsCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<FlashcardDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var existing = await _unitOfWork.Flashcards.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        if (existing.Any())
        {
            var cachedDtos = existing.Select(f => new FlashcardDto(
                f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId,
                f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
                CardType: f.CardType, Difficulty: f.Difficulty, Chapter: f.Chapter, Tags: f.Tags));

            return Result<IEnumerable<FlashcardDto>>.Success(cachedDtos, "Flashcards retrieved successfully.");
        }

        string flashcardsJson;

        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(document.Transcript))
        {
            flashcardsJson = await _aiService.GenerateFlashcardsAsync(document.Transcript, cancellationToken);
        }
        else if (AiInlineData.IsSupported(document.ContentType))
        {
            var stream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);
            flashcardsJson = await _aiService.GenerateFlashcardsAsync(ms.ToArray(), document.ContentType, cancellationToken);
        }
        else
        {
            var text = await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
            flashcardsJson = await _aiService.GenerateFlashcardsAsync(text, cancellationToken);
        }

        List<AiFlashcardItem> flashcardItems;
        try
        {
            flashcardItems = JsonSerializer.Deserialize<List<AiFlashcardItem>>(flashcardsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<AiFlashcardItem>();
        }
        catch (JsonException)
        {
            return Result<IEnumerable<FlashcardDto>>.Failure("AI returned an unexpected response format. Please try again.", "PARSE_ERROR");
        }

        var flashcards = flashcardItems.Select(f =>
        {
            var isChart = string.Equals(f.Type, "chart", StringComparison.OrdinalIgnoreCase);
            var isCloze = string.Equals(f.Type, "cloze", StringComparison.OrdinalIgnoreCase);
            var back = isChart && f.ChartData.HasValue
                ? JsonSerializer.Serialize(f.ChartData.Value)
                : f.Back;
            return new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                DocumentId = request.DocumentId,
                SourceType = "document",
                UserId = request.UserId,
                Front = f.Front,
                Back = back,
                CardType = isChart ? "chart" : isCloze ? "cloze" : "basic",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
        }).ToList();

        await _unitOfWork.Flashcards.AddRangeAsync(flashcards, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dtos = flashcards.Select(f => new FlashcardDto(
            f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId,
            f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
            CardType: f.CardType, Difficulty: f.Difficulty, Chapter: f.Chapter, Tags: f.Tags));

        return Result<IEnumerable<FlashcardDto>>.Success(dtos, "Flashcards generated successfully.");
    }

    private record AiFlashcardItem(string Front, string Back, string? Type = null, JsonElement? ChartData = null);
}
