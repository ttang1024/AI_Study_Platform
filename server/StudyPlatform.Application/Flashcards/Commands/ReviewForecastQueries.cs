using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

// ─── Forecast ────────────────────────────────────────────────────────────────

/// <summary>
/// What the next <paramref name="Days"/> days of reviewing look like, plus the backlog already
/// waiting. The shape a learner needs before deciding whether to change anything.
/// </summary>
public record GetReviewForecastQuery(Guid UserId, int Days = GetReviewForecastQuery.DefaultDays)
    : IRequest<Result<ReviewForecastDto>>
{
    public const int DefaultDays = 14;
    public const int MaxDays = 90;
}

public class GetReviewForecastQueryHandler : IRequestHandler<GetReviewForecastQuery, Result<ReviewForecastDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetReviewForecastQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ReviewForecastDto>> Handle(GetReviewForecastQuery request, CancellationToken cancellationToken)
    {
        var days = Math.Clamp(request.Days, 1, GetReviewForecastQuery.MaxDays);
        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var end = today.AddDays(days).AddTicks(-1);

        var counts = await _unitOfWork.FlashcardSrs.GetDueCountsByDayAsync(request.UserId, today, end, cancellationToken);

        // Anything due before today is backlog, not part of the forward view — it is already late
        // and would otherwise be invisible in a chart that starts at today.
        var overdue = await _unitOfWork.FlashcardSrs.CountDueByUserIdAsync(request.UserId, today.AddTicks(-1), cancellationToken);

        var settings = await _unitOfWork.UserFsrsSettings.GetByUserIdAsync(request.UserId, cancellationToken);

        var series = Enumerable.Range(0, days)
            .Select(offset =>
            {
                var day = today.AddDays(offset);
                counts.TryGetValue(day, out var count);
                return new ReviewForecastDayDto(day, count);
            })
            .ToList();

        return Result<ReviewForecastDto>.Success(new ReviewForecastDto(
            Overdue: overdue,
            Days: series,
            MaxReviewsPerDay: settings?.MaxReviewsPerDay ?? 0,
            NewCardsPerDay: settings?.NewCardsPerDay ?? FsrsParameters.DefaultNewCardsPerDay));
    }
}

// ─── Backlog rescheduling ────────────────────────────────────────────────────

/// <summary>
/// Spread an overdue pile across the next <paramref name="Days"/> days.
///
/// <para>Coming back to five hundred overdue cards is the single most common reason people abandon
/// spaced repetition. Nothing here changes a card's memory state — only its due date — so the
/// scheduler's model of what you know is untouched; you are just given a runway to clear it.</para>
/// </summary>
public record RescheduleBacklogCommand(Guid UserId, int Days = RescheduleBacklogCommand.DefaultDays)
    : IRequest<Result<RescheduleBacklogDto>>
{
    public const int DefaultDays = 7;
    public const int MaxDays = 60;
}

public class RescheduleBacklogCommandHandler : IRequestHandler<RescheduleBacklogCommand, Result<RescheduleBacklogDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public RescheduleBacklogCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<RescheduleBacklogDto>> Handle(RescheduleBacklogCommand request, CancellationToken cancellationToken)
    {
        if (request.Days < 1 || request.Days > RescheduleBacklogCommand.MaxDays)
            return Result<RescheduleBacklogDto>.Failure(
                $"Spread must be between 1 and {RescheduleBacklogCommand.MaxDays} days.", "INVALID_SPREAD");

        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var overdue = await _unitOfWork.FlashcardSrs.GetOverdueByUserIdAsync(request.UserId, today, cancellationToken);
        if (overdue.Count == 0)
            return Result<RescheduleBacklogDto>.Success(new RescheduleBacklogDto(0, request.Days, 0), "Nothing is overdue.");

        var settings = await _unitOfWork.UserFsrsSettings.GetByUserIdAsync(request.UserId, cancellationToken);
        var end = today.AddDays(request.Days - 1).AddDays(1).AddTicks(-1);
        var existing = await _unitOfWork.FlashcardSrs.GetDueCountsByDayAsync(request.UserId, today, end, cancellationToken);

        // Aim for an even total load per day — counting what is already scheduled in the window,
        // so spreading a backlog doesn't bury days that were already full.
        var scheduled = Enumerable.Range(0, request.Days)
            .Select(offset => { existing.TryGetValue(today.AddDays(offset), out var c); return c; })
            .ToArray();

        var perDay = (int)Math.Ceiling((overdue.Count + scheduled.Sum()) / (double)request.Days);
        if (settings is { MaxReviewsPerDay: > 0 })
            perDay = Math.Min(perDay, settings.MaxReviewsPerDay);
        perDay = Math.Max(1, perDay);

        var day = 0;
        var moved = 0;

        // Oldest first, so the cards that have been waiting longest come back soonest.
        foreach (var card in overdue)
        {
            while (day < request.Days - 1 && scheduled[day] >= perDay)
                day++;

            card.Due = today.AddDays(day);
            scheduled[day]++;
            moved++;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<RescheduleBacklogDto>.Success(
            new RescheduleBacklogDto(moved, request.Days, perDay),
            $"Spread {moved} overdue card{(moved == 1 ? "" : "s")} over the next {request.Days} days.");
    }
}
