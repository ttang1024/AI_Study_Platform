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
    private readonly IDocumentContentService _contentService;
    private readonly IFlashcardDeduplicator _deduplicator;

    public GenerateFlashcardsCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IDocumentContentService contentService,
        IFlashcardDeduplicator deduplicator)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _contentService = contentService;
        _deduplicator = deduplicator;
    }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GenerateFlashcardsCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<IEnumerable<FlashcardDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var existing = await _unitOfWork.Flashcards.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        if (existing.Any())
        {
            var cachedDtos = existing.Select(f => f.ToFlashcardDto());

            return Result<IEnumerable<FlashcardDto>>.Success(cachedDtos, "Flashcards retrieved successfully.");
        }

        var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
        var flashcardsJson = bytes != null
            ? await _aiService.GenerateFlashcardsAsync(bytes, document.ContentType, cancellationToken)
            : await _aiService.GenerateFlashcardsAsync(text!, cancellationToken);

        List<AiFlashcardItem> flashcardItems;
        try
        {
            flashcardItems = DeserializeFlashcards(flashcardsJson);
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

        // This handler only reaches here when the document has no cards yet, so the duplicates worth
        // catching come from *other* documents covering the same ground — the lecture slides and the
        // textbook chapter behind them state the same facts in different words. Exact-text matching
        // cannot see that; embeddings can. No-ops when embeddings are unconfigured.
        var candidates = flashcards
            .Select((f, index) => new FlashcardCandidate(index, f.Front, f.Back))
            .ToList();

        var dedup = await _deduplicator.FilterAsync(request.UserId, candidates, cancellationToken);
        var keptKeys = dedup.Kept.Select(c => c.Key).ToHashSet();
        var newCards = flashcards.Where((_, index) => keptKeys.Contains(index)).ToList();

        if (newCards.Count == 0)
        {
            return Result<IEnumerable<FlashcardDto>>.Success(
                Array.Empty<FlashcardDto>(),
                "Every generated flashcard duplicates one you already have.");
        }

        await _unitOfWork.Flashcards.AddRangeAsync(newCards, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Index only after the insert commits: a card indexed before it exists would be a phantom the
        // next generation deduplicates against.
        await _deduplicator.IndexAsync(
            request.UserId,
            newCards.Select(f => (f.FlashcardId, f.Front, f.Back)).ToList(),
            cancellationToken);

        var dtos = newCards.Select(f => f.ToFlashcardDto());

        var message = dedup.DuplicateCount > 0
            ? $"Generated {newCards.Count} flashcard(s); skipped {dedup.DuplicateCount} that duplicate cards you already have."
            : "Flashcards generated successfully.";

        return Result<IEnumerable<FlashcardDto>>.Success(dtos, message);
    }

    private static List<AiFlashcardItem> DeserializeFlashcards(string flashcardsJson)
    {
        using var document = JsonDocument.Parse(flashcardsJson);
        var flashcards = new List<AiFlashcardItem>();

        CollectFlashcards(document.RootElement, flashcards);
        if (flashcards.Count > 0)
            return flashcards;

        throw new JsonException("Expected a flashcard array.");
    }

    private static void CollectFlashcards(JsonElement element, List<AiFlashcardItem> flashcards, string? typeHint = null)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    CollectFlashcards(item, flashcards, typeHint);
                break;
            case JsonValueKind.Object:
                if (TryReadFlashcard(element, typeHint, out var flashcard))
                {
                    flashcards.Add(flashcard);
                    break;
                }

                foreach (var property in element.EnumerateObject())
                    CollectFlashcards(property.Value, flashcards, GetTypeHint(property.Name) ?? typeHint);
                break;
        }
    }

    private static bool TryReadFlashcard(JsonElement element, string? typeHint, out AiFlashcardItem flashcard)
    {
        var front = GetContent(element, "front", "question", "prompt", "statement", "text");
        var back = GetContent(element, "back", "answer", "definition", "hint", "explanation") ?? string.Empty;
        var type = GetContent(element, "type", "cardType") ?? typeHint;
        var chartData = GetProperty(element, "chartData", "chart_data", "data")?.Clone();

        if (string.IsNullOrWhiteSpace(front))
        {
            flashcard = null!;
            return false;
        }

        flashcard = new AiFlashcardItem(front, back, type, chartData);
        return true;
    }

    private static string? GetTypeHint(string propertyName)
    {
        if (propertyName.Equals("basic", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("basics", StringComparison.OrdinalIgnoreCase))
            return "basic";
        if (propertyName.Equals("cloze", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("clozes", StringComparison.OrdinalIgnoreCase))
            return "cloze";
        if (propertyName.Equals("chart", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("charts", StringComparison.OrdinalIgnoreCase))
            return "chart";

        return null;
    }

    private static string? GetContent(JsonElement element, params string[] propertyNames)
    {
        var property = GetProperty(element, propertyNames);
        if (property is null)
            return null;

        return property.Value.ValueKind == JsonValueKind.String
            ? property.Value.GetString()
            : property.Value.GetRawText();
    }

    private static JsonElement? GetProperty(JsonElement element, params string[] propertyNames)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (propertyNames.Any(name => property.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                return property.Value;
        }

        return null;
    }

}
