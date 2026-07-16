using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

// ── DTOs ────────────────────────────────────────────────────────────────────

/// <summary>One point on the model forgetting curve: predicted recall after N days without review.</summary>
public record ForgettingCurvePointDto(int Days, double Retention);

/// <summary>Calibration bin: how often recall actually succeeded when the model predicted P(recall) in [BinStart, BinEnd).</summary>
public record RetentionCalibrationBinDto(double BinStart, double BinEnd, double PredictedAvg, double ActualRate, int Reviews);

public record DailyReviewStatDto(DateTime Date, int Reviews, double SuccessRate);

public record StabilityBucketDto(string Label, int Cards);

public record RetentionAnalyticsDto(
    int TotalCardsTracked,
    int TotalReviews,
    int ReviewsLast30Days,
    // Average predicted recall probability across tracked cards right now.
    double PredictedRetentionNow,
    // Share of logged reviews rated Hard or better (i.e. recalled).
    double ActualRetentionRate,
    double AverageStability,
    double AverageDifficulty,
    IReadOnlyList<ForgettingCurvePointDto> ForgettingCurve,
    IReadOnlyList<RetentionCalibrationBinDto> Calibration,
    IReadOnlyList<DailyReviewStatDto> DailyReviews,
    IReadOnlyList<StabilityBucketDto> StabilityDistribution);

// ── Query ───────────────────────────────────────────────────────────────────

public record GetRetentionAnalyticsQuery(Guid UserId) : IRequest<Result<RetentionAnalyticsDto>>;

public class GetRetentionAnalyticsQueryHandler : IRequestHandler<GetRetentionAnalyticsQuery, Result<RetentionAnalyticsDto>>
{
    private static readonly int[] CurveDays = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];

    private readonly IUnitOfWork _unitOfWork;

    public GetRetentionAnalyticsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<RetentionAnalyticsDto>> Handle(GetRetentionAnalyticsQuery request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var srs = (await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, ct))
            .Where(s => s.State != 0 && s.Stability > 0)
            .ToList();

        var logs = (await _unitOfWork.FlashcardReviewLogs.GetByUserAsync(request.UserId, null, ct)).ToList();

        // Cards' predicted recall right now.
        var predictedNow = srs.Count > 0
            ? srs.Average(s => FsrsService.ComputeRetrievability(s.Stability, s.LastReview))
            : 0;

        var avgStability = srs.Count > 0 ? srs.Average(s => s.Stability) : 0;
        var avgDifficulty = srs.Count > 0 ? srs.Average(s => s.Difficulty) : 0;

        // Model forgetting curve at the user's average stability.
        var curve = CurveDays
            .Select(d => new ForgettingCurvePointDto(d, avgStability > 0 ? FsrsService.PredictRetention(avgStability, d) : 0))
            .ToList();

        // Actual retention: a review counts as recalled when rated Hard or better.
        // Only reviews of non-new cards are meaningful (first exposure isn't recall).
        var recallReviews = logs.Where(l => l.StateBefore != 0).ToList();
        var actualRate = recallReviews.Count > 0
            ? recallReviews.Count(l => l.Rating >= 2) / (double)recallReviews.Count
            : 0;

        // Calibration: bucket predicted retrievability vs. observed success.
        var calibration = new List<RetentionCalibrationBinDto>();
        for (var bin = 0; bin < 10; bin++)
        {
            var lo = bin / 10.0;
            var hi = lo + 0.1;
            var inBin = recallReviews
                .Where(l => l.PredictedRetrievability >= lo && (bin == 9 ? l.PredictedRetrievability <= 1.0 : l.PredictedRetrievability < hi))
                .ToList();
            if (inBin.Count == 0)
                continue;
            calibration.Add(new RetentionCalibrationBinDto(
                Math.Round(lo, 1), Math.Round(hi, 1),
                Math.Round(inBin.Average(l => l.PredictedRetrievability), 4),
                Math.Round(inBin.Count(l => l.Rating >= 2) / (double)inBin.Count, 4),
                inBin.Count));
        }

        // Daily review volume + success over the last 30 days.
        var since = now.Date.AddDays(-29);
        var daily = logs
            .Where(l => l.ReviewedAt >= since)
            .GroupBy(l => l.ReviewedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g => new DailyReviewStatDto(
                g.Key, g.Count(),
                Math.Round(g.Count(l => l.Rating >= 2) / (double)g.Count(), 4)))
            .ToList();

        // Stability distribution buckets.
        (string Label, Func<double, bool> Match)[] buckets =
        [
            ("< 1 day", s => s < 1),
            ("1–7 days", s => s is >= 1 and < 7),
            ("1–4 weeks", s => s is >= 7 and < 30),
            ("1–3 months", s => s is >= 30 and < 90),
            ("3+ months", s => s >= 90),
        ];
        var distribution = buckets
            .Select(b => new StabilityBucketDto(b.Label, srs.Count(s => b.Match(s.Stability))))
            .ToList();

        return Result<RetentionAnalyticsDto>.Success(new RetentionAnalyticsDto(
            srs.Count,
            logs.Count,
            logs.Count(l => l.ReviewedAt >= since),
            Math.Round(predictedNow, 4),
            Math.Round(actualRate, 4),
            Math.Round(avgStability, 2),
            Math.Round(avgDifficulty, 2),
            curve,
            calibration,
            daily,
            distribution));
    }
}
