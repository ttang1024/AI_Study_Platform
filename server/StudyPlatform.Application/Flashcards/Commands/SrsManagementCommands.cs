using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

// ─── Leech Query ─────────────────────────────────────────────────────────────

/// <summary>
/// Cards the scheduler keeps failing: Lapses ≥ Threshold. Suspended cards stay in the
/// list (flagged via Srs.IsSuspended) so the user can see and un-suspend them.
/// </summary>
public record GetLeechFlashcardsQuery(Guid UserId, int Threshold = GetLeechFlashcardsQuery.DefaultThreshold)
    : IRequest<Result<IEnumerable<FlashcardDto>>>
{
    public const int DefaultThreshold = 4;
    public const int MinThreshold = 2;
}

public class GetLeechFlashcardsQueryHandler : IRequestHandler<GetLeechFlashcardsQuery, Result<IEnumerable<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetLeechFlashcardsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GetLeechFlashcardsQuery request, CancellationToken cancellationToken)
    {
        var threshold = Math.Max(GetLeechFlashcardsQuery.MinThreshold, request.Threshold);
        var leeches = await _unitOfWork.FlashcardSrs.GetLeechesByUserIdAsync(request.UserId, threshold, cancellationToken);
        var dtos = leeches.Select(l => l.Card.ToFlashcardDto(l.Srs));
        return Result<IEnumerable<FlashcardDto>>.Success(dtos);
    }
}

// ─── Suspend / Unsuspend ─────────────────────────────────────────────────────

public record SetFlashcardSuspendedCommand(Guid FlashcardId, Guid UserId, bool Suspended)
    : IRequest<Result<FlashcardSrsDto>>;

public class SetFlashcardSuspendedCommandHandler : IRequestHandler<SetFlashcardSuspendedCommand, Result<FlashcardSrsDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SetFlashcardSuspendedCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardSrsDto>> Handle(SetFlashcardSuspendedCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result<FlashcardSrsDto>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        // A card without an srs row has never been reviewed and is not in any due queue,
        // so there is nothing to suspend it *from*.
        var srs = await _unitOfWork.FlashcardSrs.GetByUserAndFlashcardAsync(request.UserId, request.FlashcardId, cancellationToken);
        if (srs == null)
            return Result<FlashcardSrsDto>.Failure("Card has no review history yet.", "FLASHCARD_NOT_REVIEWED");

        srs.IsSuspended = request.Suspended;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardSrsDto>.Success(srs.ToSrsDto());
    }
}

// ─── Reset SRS ───────────────────────────────────────────────────────────────

/// <summary>
/// Forget a card's scheduling entirely: the srs row is deleted, so the next review starts
/// it over as a new card. Review logs are untouched (they reference cards loosely).
/// </summary>
public record ResetFlashcardSrsCommand(Guid FlashcardId, Guid UserId) : IRequest<Result>;

public class ResetFlashcardSrsCommandHandler : IRequestHandler<ResetFlashcardSrsCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public ResetFlashcardSrsCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(ResetFlashcardSrsCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        var srs = await _unitOfWork.FlashcardSrs.GetByUserAndFlashcardAsync(request.UserId, request.FlashcardId, cancellationToken);
        if (srs == null)
            return Result.Success("Card was already unscheduled.");

        _unitOfWork.FlashcardSrs.Remove(srs);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Card scheduling reset.");
    }
}
