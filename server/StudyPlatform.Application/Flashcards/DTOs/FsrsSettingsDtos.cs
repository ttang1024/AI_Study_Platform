using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Flashcards.DTOs;

/// <summary>Partial update — only non-null fields are applied.</summary>
public record UpdateFsrsSettingsRequest(
    double? DesiredRetention = null,
    int? MaximumIntervalDays = null,
    bool? EnableFuzz = null,
    int? NewCardsPerDay = null,
    int? MaxReviewsPerDay = null);

public record FsrsSettingsDto(
    double DesiredRetention,
    int MaximumIntervalDays,
    bool EnableFuzz,
    int NewCardsPerDay,
    // 0 means no ceiling.
    int MaxReviewsPerDay,
    // True when the user is scheduling with weights fitted to their own history.
    bool UsingOptimizedWeights,
    DateTime? WeightsOptimizedAt,
    int ReviewsAtOptimization,
    double? LogLossBefore,
    double? LogLossAfter,
    double[] Weights,
    // Reviews logged so far, against MinimumReviewsToOptimize, so the UI can gate the button.
    int ReviewCount,
    int MinimumReviewsToOptimize);

public record FsrsOptimizationDto(
    // False when the fit was no better than what the user already schedules with, so nothing was saved.
    bool Applied,
    int ReviewCount,
    double LogLossBefore,
    double LogLossAfter,
    double RmseBefore,
    double RmseAfter,
    double Improvement,
    double[] Weights);

public record UndoReviewDto(
    Guid FlashcardId,
    // The rating that was rolled back.
    int Rating,
    // True when the undone review was the card's first, so the card went back to being new.
    bool CardReset,
    StudyPlatform.Application.Documents.DTOs.FlashcardSrsDto? Srs);

public static class FsrsSettingsMappings
{
    public static FsrsSettingsDto ToFsrsSettingsDto(this UserFsrsSettings? settings, int reviewCount)
    {
        var parameters = FsrsParameters.From(settings);
        return new FsrsSettingsDto(
            DesiredRetention: parameters.DesiredRetention,
            MaximumIntervalDays: parameters.MaximumIntervalDays,
            EnableFuzz: parameters.EnableFuzz,
            NewCardsPerDay: settings?.NewCardsPerDay ?? FsrsParameters.DefaultNewCardsPerDay,
            MaxReviewsPerDay: settings?.MaxReviewsPerDay ?? 0,
            UsingOptimizedWeights: FsrsParameters.ParseWeights(settings?.WeightsJson) != null,
            WeightsOptimizedAt: settings?.WeightsOptimizedAt,
            ReviewsAtOptimization: settings?.ReviewsAtOptimization ?? 0,
            LogLossBefore: settings?.LogLossBefore,
            LogLossAfter: settings?.LogLossAfter,
            Weights: parameters.Weights,
            ReviewCount: reviewCount,
            MinimumReviewsToOptimize: FsrsOptimizer.MinimumReviews);
    }
}

public record ReviewForecastDayDto(DateTime Day, int Count);

public record ReviewForecastDto(
    // Cards already past their due date — late work, not part of the forward view.
    int Overdue,
    IReadOnlyList<ReviewForecastDayDto> Days,
    int MaxReviewsPerDay,
    int NewCardsPerDay);

public record RescheduleBacklogRequest(int Days = RescheduleBacklogDefaults.Days);

public static class RescheduleBacklogDefaults
{
    public const int Days = 7;
}

public record RescheduleBacklogDto(
    int Moved,
    int Days,
    // The per-day ceiling the spread aimed for, after the user's own review limit.
    int PerDay);
