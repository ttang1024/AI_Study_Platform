using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Services;

public interface IReviewScheduler
{
    /// <summary>
    /// Run one review through FSRS using the user's own scheduler settings, steering the resulting
    /// due date toward a quiet day when spreading is enabled.
    /// </summary>
    Task<FsrsReviewResult> ScheduleAsync(
        FlashcardSrsData srs, int rating, DateTime reviewedAt, Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Wraps the pure FSRS calculation with the two things it cannot know on its own: which settings
/// this user schedules with, and how much work each upcoming day already holds.
///
/// <para>Blind fuzz spreads a batch of cards evenly in expectation but is indifferent to the
/// calendar — it will happily drop a card onto a day that already holds two hundred. Given the
/// due counts for the days an interval may legally land on, picking the emptiest one costs the
/// same single query and actively flattens the workload instead of merely scattering it.</para>
/// </summary>
public class ReviewScheduler : IReviewScheduler
{
    private readonly IUnitOfWork _unitOfWork;

    public ReviewScheduler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<FsrsReviewResult> ScheduleAsync(
        FlashcardSrsData srs, int rating, DateTime reviewedAt, Guid userId, CancellationToken cancellationToken = default)
    {
        var settings = await _unitOfWork.UserFsrsSettings.GetByUserIdAsync(userId, cancellationToken);
        var parameters = FsrsParameters.From(settings);

        // Compute the unspread interval first — the band to search is derived from it, so applying
        // fuzz here would mean fuzzing an already-fuzzed number.
        var result = FsrsService.Review(srs, rating, reviewedAt, parameters with { EnableFuzz = false });

        if (!parameters.EnableFuzz)
            return result;

        var (min, max) = FsrsService.FuzzRange(result.ScheduledDays);
        max = Math.Min(max, parameters.MaximumIntervalDays);
        if (min >= max)
            return result;

        var today = reviewedAt.Date;
        var counts = await _unitOfWork.FlashcardSrs.GetDueCountsByDayAsync(
            userId, DateTime.SpecifyKind(today.AddDays(min), DateTimeKind.Utc),
            DateTime.SpecifyKind(today.AddDays(max).AddDays(1).AddTicks(-1), DateTimeKind.Utc),
            cancellationToken);

        var chosen = PickQuietestDay(min, max, result.ScheduledDays, today, counts, srs.FlashcardId);
        if (chosen == result.ScheduledDays)
            return result;

        return result with
        {
            ScheduledDays = chosen,
            Due = DateTime.SpecifyKind(today.AddDays(chosen), DateTimeKind.Utc),
        };
    }

    /// <summary>
    /// The least-loaded day in the band.
    ///
    /// <para>Only a strictly quieter day displaces the current pick, and the scan starts at the
    /// blind-fuzz day, so a band whose days are all equally loaded — very much including one that
    /// is uniformly empty — falls back to scattering. That case is the one fuzz exists for: a deck
    /// generated and first reviewed together gets identical intervals, and the counts cannot yet
    /// see the pile-up those are about to create.</para>
    /// </summary>
    internal static int PickQuietestDay(
        int min, int max, int ideal, DateTime today, IReadOnlyDictionary<DateTime, int> counts, Guid cardId)
    {
        var span = max - min + 1;
        var start = Math.Clamp(FsrsService.ApplyFuzz(ideal, cardId), min, max);

        var best = start;
        var bestLoad = int.MaxValue;

        for (var i = 0; i < span; i++)
        {
            var candidate = min + ((start - min + i) % span);
            counts.TryGetValue(DateTime.SpecifyKind(today.AddDays(candidate), DateTimeKind.Utc), out var load);

            if (load < bestLoad)
            {
                best = candidate;
                bestLoad = load;
            }
        }

        return best;
    }
}
