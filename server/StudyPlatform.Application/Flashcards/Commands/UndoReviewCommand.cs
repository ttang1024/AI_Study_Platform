using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

/// <summary>
/// Roll back the most recent review — the misclick every reviewer makes, which until now
/// permanently moved a card's schedule with no way back.
///
/// <para>Only the latest review can be undone, and only once: the log row is deleted, so a second
/// call rolls back the one before it (or reports there is nothing left). Restoring is exact rather
/// than recomputed, because the log stores the pre-review stability, difficulty and state.</para>
/// </summary>
public record UndoLastReviewCommand(Guid UserId, Guid? FlashcardId = null) : IRequest<Result<UndoReviewDto>>;

public class UndoLastReviewCommandHandler : IRequestHandler<UndoLastReviewCommand, Result<UndoReviewDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFlashcardSrsDataRepository _flashcardSrs;
    private readonly IFlashcardReviewLogRepository _flashcardReviewLogs;
    public UndoLastReviewCommandHandler(IUnitOfWork unitOfWork, IFlashcardSrsDataRepository flashcardSrs, IFlashcardReviewLogRepository flashcardReviewLogs) { _unitOfWork = unitOfWork;
    _flashcardSrs = flashcardSrs;
    _flashcardReviewLogs = flashcardReviewLogs; }

    public async Task<Result<UndoReviewDto>> Handle(UndoLastReviewCommand request, CancellationToken cancellationToken)
    {
        var log = await _flashcardReviewLogs.GetLatestAsync(request.UserId, request.FlashcardId, cancellationToken);
        if (log == null)
            return Result<UndoReviewDto>.Failure("There is no review to undo.", "NO_REVIEW_TO_UNDO");

        var srs = await _flashcardSrs.GetByUserAndFlashcardAsync(request.UserId, log.FlashcardId, cancellationToken);
        var previous = await _flashcardReviewLogs.GetPreviousAsync(
            request.UserId, log.FlashcardId, log.ReviewedAt, cancellationToken);

        // No earlier review means this was the card's first: there is no prior state to restore it
        // to, so the card goes back to being new — same end state as an SRS reset.
        var cardReset = previous == null;

        if (srs != null)
        {
            if (cardReset)
            {
                _flashcardSrs.Remove(srs);
            }
            else
            {
                srs.State = log.StateBefore;
                srs.Stability = log.StabilityBefore;
                srs.Difficulty = log.DifficultyBefore;
                srs.Reps = Math.Max(0, srs.Reps - 1);
                // A lapse is counted only on the Review → Relearning transition, so undo has to
                // mirror that exact condition rather than decrementing on every "Again".
                if (log.StateBefore == 2 && log.Rating == 1)
                    srs.Lapses = Math.Max(0, srs.Lapses - 1);

                srs.ScheduledDays = previous!.ScheduledDays;
                srs.ElapsedDays = previous.ElapsedDays;
                srs.LastReview = previous.ReviewedAt;
                srs.Due = DateTime.SpecifyKind(previous.ReviewedAt.Date.AddDays(previous.ScheduledDays), DateTimeKind.Utc);
            }
        }

        _flashcardReviewLogs.Remove(log);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<UndoReviewDto>.Success(
            new UndoReviewDto(
                FlashcardId: log.FlashcardId,
                Rating: log.Rating,
                CardReset: cardReset,
                Srs: cardReset ? null : srs?.ToSrsDto()),
            "Review undone.");
    }
}
