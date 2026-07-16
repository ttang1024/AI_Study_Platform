using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Mistakes;

public record PromotedMistakesDto(int Created, int Skipped, IReadOnlyList<Guid> FlashcardIds);

/// <summary>
/// Turns missed questions into flashcards that are due immediately.
///
/// The mistake notebook already knows exactly what a user got wrong, but nothing was ever done with it:
/// the entries sat in a list to be re-read. A question you missed is the single highest-value thing you
/// could be reviewing, so this promotes it into the FSRS engine, which is the machinery that actually
/// makes review stick.
///
/// Idempotent by way of <see cref="MistakeEntry.FlashcardId"/> — promoting the same mistake twice
/// returns it as skipped rather than making a second copy of the card.
/// </summary>
/// <param name="MistakeIds">
/// The mistakes to promote. Empty promotes every open mistake that does not already have a card.
/// </param>
public record PromoteMistakesToFlashcardsCommand(Guid UserId, IReadOnlyCollection<Guid> MistakeIds)
    : IRequest<Result<PromotedMistakesDto>>;

public class PromoteMistakesToFlashcardsCommandHandler
    : IRequestHandler<PromoteMistakesToFlashcardsCommand, Result<PromotedMistakesDto>>
{
    /// <summary>Missing a question this many times marks the card hard, which makes FSRS treat it accordingly.</summary>
    private const int HardAfterMisses = 3;

    /// <summary>Tag applied to promoted cards so the user can find (and bulk-delete) them later.</summary>
    private const string MistakeTag = "mistake";

    private readonly IUnitOfWork _unitOfWork;

    public PromoteMistakesToFlashcardsCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PromotedMistakesDto>> Handle(
        PromoteMistakesToFlashcardsCommand request, CancellationToken ct)
    {
        var requested = request.MistakeIds.ToHashSet();

        var candidates = (await _unitOfWork.MistakeEntries.FindAsync(
                m => m.UserId == request.UserId && m.Status == "open", ct))
            .Where(m => requested.Count == 0 || requested.Contains(m.MistakeEntryId))
            .ToList();

        if (candidates.Count == 0)
            return Result<PromotedMistakesDto>.Failure("No open mistakes to promote.", "NO_MISTAKES");

        // Already promoted ones are reported, not re-created. Re-running the button after adding a few
        // new mistakes should promote only the new ones.
        var toPromote = candidates.Where(m => m.FlashcardId == null).ToList();
        var skipped = candidates.Count - toPromote.Count;

        var now = DateTime.UtcNow;
        var flashcardIds = new List<Guid>(toPromote.Count);

        foreach (var mistake in toPromote)
        {
            var flashcard = new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = request.UserId,
                DocumentId = mistake.DocumentId,
                VideoId = mistake.VideoId,
                SourceType = mistake.SourceType,
                Front = mistake.Question,
                Back = BuildBack(mistake),
                CardType = "basic",
                Difficulty = mistake.TimesMissed >= HardAfterMisses ? "hard" : "medium",
                Tags = [MistakeTag],
                CreatedAt = now,
                UpdatedAt = now,
            };
            await _unitOfWork.Flashcards.AddAsync(flashcard, ct);

            // The SRS row has to be written here rather than left to the first review. A flashcard with
            // no FlashcardSrsData never appears in the due queue at all — every "due" path reads that
            // table — so without this the promoted card would be created and then never surface.
            await _unitOfWork.FlashcardSrs.AddAsync(new FlashcardSrsData
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                FlashcardId = flashcard.FlashcardId,
                Due = now, // due immediately: the whole point is to review it now, not in three days
            }, ct);

            mistake.FlashcardId = flashcard.FlashcardId;
            _unitOfWork.MistakeEntries.Update(mistake);

            flashcardIds.Add(flashcard.FlashcardId);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        return Result<PromotedMistakesDto>.Success(
            new PromotedMistakesDto(flashcardIds.Count, skipped, flashcardIds),
            flashcardIds.Count == 0
                ? "Every selected mistake already has a flashcard."
                : $"Promoted {flashcardIds.Count} mistake(s) to flashcards, due now.");
    }

    /// <summary>
    /// The answer side. The explanation is why the answer is right, and re-reading it is most of the
    /// value of reviewing a missed question — so it belongs on the card, not just in the notebook.
    /// </summary>
    private static string BuildBack(MistakeEntry mistake)
        => string.IsNullOrWhiteSpace(mistake.Explanation)
            ? mistake.CorrectAnswer
            : $"{mistake.CorrectAnswer}\n\n{mistake.Explanation}";
}
