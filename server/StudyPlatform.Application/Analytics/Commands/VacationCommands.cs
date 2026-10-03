using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Commands;

/// <summary>
/// Schedules vacation cover days so the study streak survives planned time off.
/// Replaces any previously scheduled vacation days from the start date forward.
/// </summary>
public record SetVacationCommand(Guid UserId, DateTime StartDate, DateTime EndDate) : IRequest<Result>;

/// <summary>Cancels scheduled vacation days from today forward (past covered days are kept).</summary>
public record CancelVacationCommand(Guid UserId) : IRequest<Result>;

public class SetVacationCommandHandler : IRequestHandler<SetVacationCommand, Result>
{
    private const int MaxVacationDays = 60;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;

    public SetVacationCommandHandler(IUnitOfWork unitOfWork, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<Result> Handle(SetVacationCommand request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var start = DateTime.SpecifyKind(request.StartDate.Date, DateTimeKind.Utc);
        var end = DateTime.SpecifyKind(request.EndDate.Date, DateTimeKind.Utc);

        if (start < today)
            start = today;
        if (end < start)
            return Result.Failure("End date must be on or after the start date.", "INVALID_RANGE");
        if ((end - start).TotalDays + 1 > MaxVacationDays)
            return Result.Failure($"Vacation can cover at most {MaxVacationDays} days.", "RANGE_TOO_LONG");

        var existing = (await _unitOfWork.StreakCoverDays.GetByUserAsync(request.UserId, cancellationToken)).ToList();

        // Replace any upcoming vacation with the new range.
        var upcomingVacation = existing.Where(c => c.Type == "vacation" && c.Date.Date >= today).ToList();
        _unitOfWork.StreakCoverDays.RemoveRange(upcomingVacation);

        var occupied = existing.Except(upcomingVacation).Select(c => c.Date.Date).ToHashSet();
        for (var day = start; day <= end; day = day.AddDays(1))
        {
            if (occupied.Contains(day))
                continue;
            await _unitOfWork.StreakCoverDays.AddAsync(new StreakCoverDay
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Date = day,
                Type = "vacation",
                CreatedAt = DateTime.UtcNow,
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(DashboardSummaryCache.Key(request.UserId), cancellationToken);
        return Result.Success("Vacation scheduled.");
    }
}

public class CancelVacationCommandHandler : IRequestHandler<CancelVacationCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;

    public CancelVacationCommandHandler(IUnitOfWork unitOfWork, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<Result> Handle(CancelVacationCommand request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var upcoming = (await _unitOfWork.StreakCoverDays.GetByUserAsync(request.UserId, cancellationToken))
            .Where(c => c.Type == "vacation" && c.Date.Date >= today)
            .ToList();

        _unitOfWork.StreakCoverDays.RemoveRange(upcoming);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(DashboardSummaryCache.Key(request.UserId), cancellationToken);
        return Result.Success("Vacation cancelled.");
    }
}
