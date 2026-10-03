using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record ImportFlashcardRow(string Front, string Back, string? CardType, List<string>? Tags);

public record ImportFlashcardsResultDto(int ImportedCount, int SkippedCount);

/// <summary>
/// Bulk-imports flashcards (e.g. from an Anki TSV/CSV export parsed client-side).
/// Rows whose front already exists for the user are skipped to keep re-imports idempotent.
/// </summary>
public record ImportFlashcardsCommand(Guid UserId, IReadOnlyList<ImportFlashcardRow> Rows)
    : IRequest<Result<ImportFlashcardsResultDto>>;

public class ImportFlashcardsCommandHandler : IRequestHandler<ImportFlashcardsCommand, Result<ImportFlashcardsResultDto>>
{
    private const int MaxRows = 2000;

    private readonly IUnitOfWork _unitOfWork;

    public ImportFlashcardsCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ImportFlashcardsResultDto>> Handle(ImportFlashcardsCommand request, CancellationToken cancellationToken)
    {
        if (request.Rows.Count == 0)
            return Result<ImportFlashcardsResultDto>.Failure("No cards to import.", "NO_ROWS");
        if (request.Rows.Count > MaxRows)
            return Result<ImportFlashcardsResultDto>.Failure($"Too many cards — limit is {MaxRows} per import.", "TOO_MANY_ROWS");

        var existing = await _unitOfWork.Flashcards.FindAsync(f => f.UserId == request.UserId, cancellationToken);
        var existingFronts = existing.Select(f => f.Front.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var now = DateTime.UtcNow;
        var toAdd = new List<Flashcard>();
        var skipped = 0;

        foreach (var row in request.Rows)
        {
            var front = row.Front?.Trim() ?? string.Empty;
            var back = row.Back?.Trim() ?? string.Empty;
            if (front.Length == 0 || back.Length == 0 || existingFronts.Contains(front))
            {
                skipped++;
                continue;
            }
            existingFronts.Add(front);

            toAdd.Add(new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = request.UserId,
                SourceType = "document",
                Front = front,
                Back = back,
                CardType = row.CardType is "cloze" or "chart" ? row.CardType : "basic",
                Tags = row.Tags?.Where(t => !string.IsNullOrWhiteSpace(t)).Take(10).ToList() ?? new List<string>(),
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        if (toAdd.Count > 0)
        {
            await _unitOfWork.Flashcards.AddRangeAsync(toAdd, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result<ImportFlashcardsResultDto>.Success(
            new ImportFlashcardsResultDto(toAdd.Count, skipped),
            $"Imported {toAdd.Count} cards ({skipped} skipped).");
    }
}
