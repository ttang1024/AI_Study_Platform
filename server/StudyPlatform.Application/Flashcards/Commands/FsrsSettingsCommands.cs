using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

// ─── Read settings ───────────────────────────────────────────────────────────

public record GetFsrsSettingsQuery(Guid UserId) : IRequest<Result<FsrsSettingsDto>>;

public class GetFsrsSettingsQueryHandler : IRequestHandler<GetFsrsSettingsQuery, Result<FsrsSettingsDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetFsrsSettingsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FsrsSettingsDto>> Handle(GetFsrsSettingsQuery request, CancellationToken cancellationToken)
    {
        // No row is not an error — it means "all defaults", and reading settings should never
        // be the thing that writes to the database.
        var settings = await _unitOfWork.UserFsrsSettings.GetByUserIdAsync(request.UserId, cancellationToken);
        var reviewCount = await _unitOfWork.FlashcardReviewLogs.CountAsync(l => l.UserId == request.UserId, cancellationToken);
        return Result<FsrsSettingsDto>.Success(settings.ToFsrsSettingsDto(reviewCount));
    }
}

// ─── Update settings ─────────────────────────────────────────────────────────

/// <summary>Null fields are left as they are, so the client can send one slider at a time.</summary>
public record UpdateFsrsSettingsCommand(
    Guid UserId,
    double? DesiredRetention = null,
    int? MaximumIntervalDays = null,
    bool? EnableFuzz = null,
    int? NewCardsPerDay = null,
    int? MaxReviewsPerDay = null) : IRequest<Result<FsrsSettingsDto>>;

public class UpdateFsrsSettingsCommandHandler : IRequestHandler<UpdateFsrsSettingsCommand, Result<FsrsSettingsDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UpdateFsrsSettingsCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FsrsSettingsDto>> Handle(UpdateFsrsSettingsCommand request, CancellationToken cancellationToken)
    {
        if (request.DesiredRetention is { } retention &&
            (retention < FsrsParameters.MinRetention || retention > FsrsParameters.MaxRetention))
            return Result<FsrsSettingsDto>.Failure(
                $"Desired retention must be between {FsrsParameters.MinRetention:P0} and {FsrsParameters.MaxRetention:P0}.",
                "INVALID_RETENTION");

        if (request.MaximumIntervalDays is { } maxInterval &&
            (maxInterval < 1 || maxInterval > FsrsParameters.MaxMaximumIntervalDays))
            return Result<FsrsSettingsDto>.Failure(
                $"Maximum interval must be between 1 and {FsrsParameters.MaxMaximumIntervalDays} days.",
                "INVALID_MAX_INTERVAL");

        if (request.NewCardsPerDay is { } newPerDay &&
            (newPerDay < 0 || newPerDay > FsrsParameters.MaxNewCardsPerDay))
            return Result<FsrsSettingsDto>.Failure(
                $"New cards per day must be between 0 and {FsrsParameters.MaxNewCardsPerDay}.",
                "INVALID_NEW_LIMIT");

        if (request.MaxReviewsPerDay is { } maxReviews &&
            (maxReviews < 0 || maxReviews > FsrsParameters.MaxReviewsPerDayCeiling))
            return Result<FsrsSettingsDto>.Failure(
                $"Reviews per day must be between 0 (no limit) and {FsrsParameters.MaxReviewsPerDayCeiling}.",
                "INVALID_REVIEW_LIMIT");

        var settings = await GetOrCreateAsync(_unitOfWork, request.UserId, cancellationToken);

        if (request.DesiredRetention.HasValue) settings.DesiredRetention = request.DesiredRetention.Value;
        if (request.MaximumIntervalDays.HasValue) settings.MaximumIntervalDays = request.MaximumIntervalDays.Value;
        if (request.EnableFuzz.HasValue) settings.EnableFuzz = request.EnableFuzz.Value;
        if (request.NewCardsPerDay.HasValue) settings.NewCardsPerDay = request.NewCardsPerDay.Value;
        if (request.MaxReviewsPerDay.HasValue) settings.MaxReviewsPerDay = request.MaxReviewsPerDay.Value;
        settings.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var reviewCount = await _unitOfWork.FlashcardReviewLogs.CountAsync(l => l.UserId == request.UserId, cancellationToken);
        return Result<FsrsSettingsDto>.Success(settings.ToFsrsSettingsDto(reviewCount), "Scheduler settings updated.");
    }

    internal static async Task<UserFsrsSettings> GetOrCreateAsync(IUnitOfWork unitOfWork, Guid userId, CancellationToken ct)
    {
        var settings = await unitOfWork.UserFsrsSettings.GetByUserIdAsync(userId, ct);
        if (settings != null) return settings;

        settings = new UserFsrsSettings
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        await unitOfWork.UserFsrsSettings.AddAsync(settings, ct);
        return settings;
    }
}

// ─── Optimize weights ────────────────────────────────────────────────────────

/// <summary>
/// Fit the FSRS weights to this user's own review history and, if the fit is better calibrated
/// than what they are scheduling with today, adopt it.
/// </summary>
public record OptimizeFsrsWeightsCommand(Guid UserId) : IRequest<Result<FsrsOptimizationDto>>;

public class OptimizeFsrsWeightsCommandHandler : IRequestHandler<OptimizeFsrsWeightsCommand, Result<FsrsOptimizationDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFsrsOptimizer _optimizer;

    public OptimizeFsrsWeightsCommandHandler(IUnitOfWork unitOfWork, IFsrsOptimizer optimizer)
    {
        _unitOfWork = unitOfWork;
        _optimizer = optimizer;
    }

    public async Task<Result<FsrsOptimizationDto>> Handle(OptimizeFsrsWeightsCommand request, CancellationToken cancellationToken)
    {
        var logs = (await _unitOfWork.FlashcardReviewLogs.GetByUserAsync(request.UserId, null, cancellationToken)).ToList();

        // Always fit from the stock weights, not from a previous fit: re-optimizing on top of an
        // earlier run compounds its errors, and the reported "before" would stop being comparable.
        var result = _optimizer.Optimize(logs, FsrsParameters.DefaultWeights, cancellationToken);
        if (result == null)
            return Result<FsrsOptimizationDto>.Failure(
                $"Not enough review history yet — {FsrsOptimizer.MinimumReviews} reviews are needed to fit the scheduler.",
                "NOT_ENOUGH_REVIEWS");

        var applied = result.LogLossAfter < result.LogLossBefore;
        if (applied)
        {
            var settings = await UpdateFsrsSettingsCommandHandler.GetOrCreateAsync(_unitOfWork, request.UserId, cancellationToken);
            settings.WeightsJson = FsrsParameters.Serialize(result.Weights);
            settings.WeightsOptimizedAt = DateTime.UtcNow;
            settings.ReviewsAtOptimization = result.ReviewCount;
            settings.LogLossBefore = result.LogLossBefore;
            settings.LogLossAfter = result.LogLossAfter;
            settings.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result<FsrsOptimizationDto>.Success(
            new FsrsOptimizationDto(
                Applied: applied,
                ReviewCount: result.ReviewCount,
                LogLossBefore: result.LogLossBefore,
                LogLossAfter: result.LogLossAfter,
                RmseBefore: result.RmseBefore,
                RmseAfter: result.RmseAfter,
                Improvement: Math.Round(result.Improvement, 4),
                Weights: result.Weights),
            applied
                ? "Scheduler tuned to your review history."
                : "Your history is already best explained by the default scheduler — nothing changed.");
    }
}

// ─── Reset weights ───────────────────────────────────────────────────────────

/// <summary>Drop a fitted weight set and go back to stock FSRS-4.5. Preferences are kept.</summary>
public record ResetFsrsWeightsCommand(Guid UserId) : IRequest<Result<FsrsSettingsDto>>;

public class ResetFsrsWeightsCommandHandler : IRequestHandler<ResetFsrsWeightsCommand, Result<FsrsSettingsDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public ResetFsrsWeightsCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FsrsSettingsDto>> Handle(ResetFsrsWeightsCommand request, CancellationToken cancellationToken)
    {
        var settings = await _unitOfWork.UserFsrsSettings.GetByUserIdAsync(request.UserId, cancellationToken);
        var reviewCount = await _unitOfWork.FlashcardReviewLogs.CountAsync(l => l.UserId == request.UserId, cancellationToken);

        if (settings == null)
            return Result<FsrsSettingsDto>.Success(((UserFsrsSettings?)null).ToFsrsSettingsDto(reviewCount), "Already using the default scheduler.");

        settings.WeightsJson = null;
        settings.WeightsOptimizedAt = null;
        settings.ReviewsAtOptimization = 0;
        settings.LogLossBefore = null;
        settings.LogLossAfter = null;
        settings.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FsrsSettingsDto>.Success(settings.ToFsrsSettingsDto(reviewCount), "Scheduler reset to defaults.");
    }
}
