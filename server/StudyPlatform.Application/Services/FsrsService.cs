using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

public record FsrsReviewResult(
    double Stability,
    double Difficulty,
    int State,
    int Reps,
    int Lapses,
    int ScheduledDays,
    int ElapsedDays,
    DateTime Due,
    DateTime LastReview,
    double Retrievability);

/// <summary>
/// FSRS-4.5 (Free Spaced Repetition Scheduler) algorithm implementation.
/// Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
/// States: 0=New, 1=Learning, 2=Review, 3=Relearning
///
/// <para>Every entry point takes an optional <see cref="FsrsParameters"/>. Omitting it uses stock
/// FSRS-4.5 weights at 0.9 desired retention with no fuzz — which is bit-for-bit what the scheduler
/// did before per-user tuning existed.</para>
/// </summary>
public static class FsrsService
{
    private const double Factor = 19.0 / 81.0;
    private const double Decay = -0.5;

    /// <summary>Intervals below this many days are left alone by fuzz — there is nothing to spread.</summary>
    private const int MinFuzzInterval = 3;

    public static FsrsReviewResult Review(FlashcardSrsData srs, int rating, DateTime reviewedAt, FsrsParameters? parameters = null)
    {
        var p = parameters ?? FsrsParameters.Default;
        var w = p.Weights;

        var elapsedDays = srs.LastReview.HasValue
            ? Math.Max(0, (reviewedAt - srs.LastReview.Value).TotalDays)
            : 0;

        double r = srs.State != 0 && srs.Stability > 0 && elapsedDays > 0
            ? Retrievability(srs.Stability, elapsedDays)
            : 1.0;

        double newStability;
        double newDifficulty;
        int newState;
        int scheduledDays;
        int lapses = srs.Lapses;

        switch (srs.State)
        {
            case 0: // New
                newStability = InitialStability(w, rating);
                newDifficulty = InitialDifficulty(w, rating);
                if (rating <= 2)
                {
                    newState = 1; // Learning
                    scheduledDays = 1;
                }
                else
                {
                    newState = 2; // Review
                    scheduledDays = NextInterval(newStability, p, srs.FlashcardId);
                }
                break;

            case 1: // Learning
                newDifficulty = UpdateDifficulty(w, srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = InitialStability(w, 1);
                    newState = 1;
                    scheduledDays = 1;
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, NextRecallStability(w, srs.Difficulty, srs.Stability, r, rating))
                        : InitialStability(w, rating);
                    newState = 2;
                    scheduledDays = NextInterval(newStability, p, srs.FlashcardId);
                }
                break;

            case 2: // Review
                newDifficulty = UpdateDifficulty(w, srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, NextForgetStability(w, srs.Difficulty, srs.Stability, r));
                    newState = 3;
                    scheduledDays = 1;
                    lapses++;
                }
                else
                {
                    newStability = Math.Max(0.1, NextRecallStability(w, srs.Difficulty, srs.Stability, r, rating));
                    newState = 2;
                    scheduledDays = NextInterval(newStability, p, srs.FlashcardId);
                }
                break;

            default: // Relearning (State == 3)
                newDifficulty = UpdateDifficulty(w, srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, NextForgetStability(w, srs.Difficulty, srs.Stability, r));
                    newState = 3;
                    scheduledDays = 1;
                    // lapses already counted on Review→Relearning transition; don't increment again
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, NextRecallStability(w, srs.Difficulty, srs.Stability, r, rating))
                        : srs.Stability;
                    newState = 2;
                    scheduledDays = NextInterval(newStability, p, srs.FlashcardId);
                }
                break;
        }

        return new FsrsReviewResult(
            Stability: Math.Round(newStability, 4),
            Difficulty: Math.Round(Math.Clamp(newDifficulty, 1, 10), 4),
            State: newState,
            Reps: srs.Reps + 1,
            Lapses: lapses,
            ScheduledDays: scheduledDays,
            ElapsedDays: (int)Math.Round(elapsedDays),
            Due: DateTime.SpecifyKind(reviewedAt.Date.AddDays(scheduledDays), DateTimeKind.Utc),
            LastReview: reviewedAt,
            Retrievability: Math.Round(r, 4));
    }

    /// <summary>Model-predicted recall probability after <paramref name="elapsedDays"/> days for a given stability.</summary>
    public static double PredictRetention(double stability, double elapsedDays)
        => stability <= 0 ? 0 : Math.Round(Retrievability(stability, Math.Max(0, elapsedDays)), 4);

    public static double ComputeRetrievability(double stability, DateTime? lastReview)
    {
        if (!lastReview.HasValue || stability <= 0) return 0;
        var elapsed = (DateTime.UtcNow - lastReview.Value).TotalDays;
        return elapsed >= 0 ? Math.Round(Retrievability(stability, elapsed), 4) : 1.0;
    }

    /// <summary>
    /// Days until recall probability decays to the desired retention, clamped to
    /// [1, maximum interval] and optionally fuzzed.
    ///
    /// <para>At the default 0.9 retention the formula collapses to <c>interval = stability</c>,
    /// which is what the scheduler used before retention was configurable.</para>
    /// </summary>
    public static int NextInterval(double stability, FsrsParameters parameters, Guid fuzzSeed = default)
    {
        var raw = stability / Factor * (Math.Pow(parameters.DesiredRetention, 1 / Decay) - 1);
        var days = (int)Math.Round(Math.Clamp(raw, 1, parameters.MaximumIntervalDays));

        if (parameters.EnableFuzz)
            days = ApplyFuzz(days, fuzzSeed);

        return Math.Clamp(days, 1, parameters.MaximumIntervalDays);
    }

    /// <summary>
    /// Nudge an interval by a few percent so a batch of cards learned together doesn't stay welded
    /// into one review pile. The offset is derived from the card id, so it is stable: recomputing
    /// the same review twice yields the same date.
    /// </summary>
    public static int ApplyFuzz(int intervalDays, Guid seed)
    {
        var (min, max) = FuzzRange(intervalDays);
        if (min == max) return intervalDays;

        // Deterministic offset inside the band, from the card id. Hashed over the raw bytes rather
        // than via GetHashCode so the same card always lands on the same day, in any process.
        return min + (int)(HashSeed(seed) % (uint)(max - min + 1));
    }

    /// <summary>
    /// The inclusive band of days an interval may be moved into. Short intervals move by a larger
    /// fraction (but at least a day), long ones by a smaller one — the usual SRS convention.
    ///
    /// <para>Exposed so a scheduler that knows the user's upcoming workload can pick the quietest
    /// day in the band instead of a blind offset; <see cref="ApplyFuzz"/> is the same choice made
    /// without that knowledge.</para>
    /// </summary>
    public static (int Min, int Max) FuzzRange(int intervalDays)
    {
        if (intervalDays < MinFuzzInterval) return (intervalDays, intervalDays);

        var fraction = intervalDays switch
        {
            < 7 => 0.15,
            < 20 => 0.10,
            _ => 0.05
        };

        var delta = Math.Max(1, (int)Math.Round(intervalDays * fraction));
        return (Math.Max(1, intervalDays - delta), intervalDays + delta);
    }

    internal static double InitialStability(double[] w, int rating) => w[rating - 1];

    internal static double InitialDifficulty(double[] w, int rating)
        => w[4] - Math.Exp(w[5] * (rating - 1)) + 1;

    private static uint HashSeed(Guid seed)
    {
        Span<byte> bytes = stackalloc byte[16];
        seed.TryWriteBytes(bytes);
        uint hash = 2166136261; // FNV-1a
        foreach (var b in bytes)
        {
            hash ^= b;
            hash *= 16777619;
        }
        return hash;
    }

    internal static double Retrievability(double stability, double elapsedDays)
        => Math.Pow(1 + Factor * elapsedDays / stability, Decay);

    internal static double NextRecallStability(double[] w, double d, double s, double r, int g)
    {
        double hardPenalty = g == 2 ? w[15] : 1.0;
        double easyBonus = g == 4 ? w[16] : 1.0;
        // S' = S · (1 + SInc): stability can only grow on a successful recall.
        return s * (1 + Math.Exp(w[8]) * (11 - d)
                        * Math.Pow(s, -w[9])
                        * (Math.Exp(w[10] * (1 - r)) - 1)
                        * hardPenalty * easyBonus);
    }

    internal static double NextForgetStability(double[] w, double d, double s, double r)
        => w[11] * Math.Pow(d, -w[12])
           * (Math.Pow(s + 1, w[13]) - 1)
           * Math.Exp(w[14] * (1 - r));

    internal static double UpdateDifficulty(double[] w, double d, int g)
    {
        double deltaD = -w[6] * (g - 3);
        double dNew = d + deltaD * ((10.0 - d) / 9.0);
        double d04 = w[4] - Math.Exp(w[5] * 3) + 1;
        dNew = w[7] * d04 + (1 - w[7]) * dNew;
        return dNew;
    }
}
