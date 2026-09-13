using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

// ─── FSRS Review ─────────────────────────────────────────────────────────────

public record ReviewFlashcardCommand(Guid FlashcardId, Guid UserId, int Rating) : IRequest<Result<ReviewFlashcardResponse>>;

public class ReviewFlashcardCommandHandler : IRequestHandler<ReviewFlashcardCommand, Result<ReviewFlashcardResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IReviewScheduler _scheduler;

    public ReviewFlashcardCommandHandler(IUnitOfWork unitOfWork, IReviewScheduler scheduler)
    {
        _unitOfWork = unitOfWork;
        _scheduler = scheduler;
    }

    public async Task<Result<ReviewFlashcardResponse>> Handle(ReviewFlashcardCommand request, CancellationToken cancellationToken)
    {
        if (request.Rating is < 1 or > 4)
            return Result<ReviewFlashcardResponse>.Failure("Rating must be 1–4.", "INVALID_RATING");

        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result<ReviewFlashcardResponse>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        var srs = await _unitOfWork.FlashcardSrs.GetByUserAndFlashcardAsync(
            request.UserId, request.FlashcardId, cancellationToken)
            ?? new FlashcardSrsData
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                FlashcardId = request.FlashcardId,
                Due = DateTime.UtcNow,
            };

        var reviewedAt = DateTime.UtcNow;
        var result = await _scheduler.ScheduleAsync(srs, request.Rating, reviewedAt, request.UserId, cancellationToken);

        // Append to the review log before mutating srs — the "before" values are what undo
        // restores, and the whole log is what the FSRS weight optimizer fits against.
        await _unitOfWork.FlashcardReviewLogs.AddAsync(new FlashcardReviewLog
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            FlashcardId = request.FlashcardId,
            Rating = request.Rating,
            StateBefore = srs.State,
            StabilityBefore = srs.Stability,
            DifficultyBefore = srs.Difficulty,
            ElapsedDays = result.ElapsedDays,
            PredictedRetrievability = result.Retrievability,
            StabilityAfter = result.Stability,
            DifficultyAfter = result.Difficulty,
            ScheduledDays = result.ScheduledDays,
            ReviewedAt = reviewedAt,
        }, cancellationToken);

        srs.State = result.State;
        srs.Stability = result.Stability;
        srs.Difficulty = result.Difficulty;
        srs.Reps = result.Reps;
        srs.Lapses = result.Lapses;
        srs.ScheduledDays = result.ScheduledDays;
        srs.ElapsedDays = result.ElapsedDays;
        srs.LastReview = result.LastReview;
        srs.Due = result.Due;

        if (srs.Reps == 1)
            await _unitOfWork.FlashcardSrs.AddAsync(srs, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var srsDto = srs.ToSrsDto();
        return Result<ReviewFlashcardResponse>.Success(
            new ReviewFlashcardResponse(result.ScheduledDays, result.Retrievability, srsDto));
    }
}

// ─── SRS State Query ─────────────────────────────────────────────────────────

public record GetFlashcardSrsQuery(Guid UserId) : IRequest<Result<IEnumerable<FlashcardSrsDto>>>;

public class GetFlashcardSrsQueryHandler : IRequestHandler<GetFlashcardSrsQuery, Result<IEnumerable<FlashcardSrsDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetFlashcardSrsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<FlashcardSrsDto>>> Handle(GetFlashcardSrsQuery request, CancellationToken cancellationToken)
    {
        var all = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var dtos = all.Select(s => s.ToSrsDto());
        return Result<IEnumerable<FlashcardSrsDto>>.Success(dtos);
    }
}
