using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <param name="Weights">The fitted weight vector.</param>
/// <param name="ReviewCount">Reviews that actually scored — first-ever reviews of a card are excluded.</param>
/// <param name="LogLossBefore">Binary log-loss of <c>startWeights</c> on this history (lower is better).</param>
/// <param name="LogLossAfter">Binary log-loss of the fitted weights.</param>
public record FsrsOptimizationResult(
    double[] Weights,
    int ReviewCount,
    double LogLossBefore,
    double LogLossAfter,
    double RmseBefore,
    double RmseAfter)
{
    /// <summary>Relative log-loss reduction, e.g. 0.06 for a 6% better-calibrated model.</summary>
    public double Improvement => LogLossBefore > 0 ? (LogLossBefore - LogLossAfter) / LogLossBefore : 0;
}

public interface IFsrsOptimizer
{
    /// <summary>
    /// Fit FSRS weights to a user's review history. Returns null when the history is too short
    /// to say anything — fitting 19 parameters to a handful of reviews produces confident nonsense.
    /// </summary>
    FsrsOptimizationResult? Optimize(
        IReadOnlyCollection<FlashcardReviewLog> logs,
        double[]? startWeights = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Fits the 19 FSRS weights to one user's own review log.
///
/// <para>The method is the same one the reference FSRS optimizer uses, minus the autograd: replay
/// every card's rating history through the state machine, ask the model for the recall probability
/// it would have predicted at each review, and score that against what actually happened
/// (rating ≥ 2 = recalled) with binary log-loss. The search is bounded coordinate descent with a
/// shrinking step — derivative-free, so it can't diverge, and cheap enough to run inline on a
/// request rather than needing a worker.</para>
/// </summary>
public class FsrsOptimizer : IFsrsOptimizer
{
    /// <summary>
    /// Below this many scored reviews the fit is noise. The reference optimizer wants ~1000;
    /// this is the point where a fit starts beating the defaults often enough to be worth offering.
    /// </summary>
    public const int MinimumReviews = 200;

    /// <summary>Most recent reviews to fit on. Caps the work per run and favours current behaviour.</summary>
    private const int MaxReviews = 20_000;

    private const int Sweeps = 6;
    private static readonly double[] StepFractions = [0.30, 0.12, 0.05];
    private static readonly int[] Directions = [1, -1];

    public FsrsOptimizationResult? Optimize(
        IReadOnlyCollection<FlashcardReviewLog> logs,
        double[]? startWeights = null,
        CancellationToken cancellationToken = default)
    {
        var sequences = BuildSequences(logs);
        var scored = sequences.Sum(s => s.Count(r => r.StateBefore != 0));
        if (scored < MinimumReviews) return null;

        var start = FsrsParameters.Clamp(startWeights ?? FsrsParameters.DefaultWeights);
        var best = (double[])start.Clone();
        var bestLoss = Evaluate(sequences, best).LogLoss;
        var baseline = Evaluate(sequences, start);

        foreach (var fraction in StepFractions)
        {
            for (var sweep = 0; sweep < Sweeps; sweep++)
            {
                var improvedThisSweep = false;

                for (var i = 0; i < FsrsParameters.WeightCount; i++)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var (min, max) = FsrsParameters.WeightBounds[i];
                    // Step relative to the parameter's own range, so w3 (spanning 0.01–100) and
                    // w7 (spanning 0–0.75) move by comparable amounts of their scale.
                    var step = (max - min) * fraction;

                    foreach (var direction in Directions)
                    {
                        var candidate = (double[])best.Clone();
                        candidate[i] = Math.Clamp(best[i] + direction * step, min, max);
                        if (Math.Abs(candidate[i] - best[i]) < 1e-9) continue;

                        var loss = Evaluate(sequences, candidate).LogLoss;
                        if (loss < bestLoss - 1e-9)
                        {
                            best = candidate;
                            bestLoss = loss;
                            improvedThisSweep = true;
                            break; // this direction worked; the next sweep can push further
                        }
                    }
                }

                if (!improvedThisSweep) break; // this step size has nothing left to give
            }
        }

        var fitted = Evaluate(sequences, best);

        return new FsrsOptimizationResult(
            Weights: best.Select(x => Math.Round(x, 4)).ToArray(),
            ReviewCount: scored,
            LogLossBefore: Math.Round(baseline.LogLoss, 6),
            LogLossAfter: Math.Round(fitted.LogLoss, 6),
            RmseBefore: Math.Round(baseline.Rmse, 6),
            RmseAfter: Math.Round(fitted.Rmse, 6));
    }

    /// <summary>
    /// One card's ratings in the order they happened. Replay needs the whole chain because
    /// stability and difficulty at review <c>n</c> depend on every review before it.
    /// </summary>
    private static List<FlashcardReviewLog[]> BuildSequences(IReadOnlyCollection<FlashcardReviewLog> logs)
        => logs
            .OrderByDescending(l => l.ReviewedAt)
            .Take(MaxReviews)
            .GroupBy(l => l.FlashcardId)
            .Select(g => g.OrderBy(l => l.ReviewedAt).ToArray())
            .Where(seq => seq.Length > 0)
            .ToList();

    /// <summary>
    /// Replay every sequence with the candidate weights and score the predictions.
    ///
    /// <para>Elapsed days come from the log, not from the candidate's own schedule: the reviews
    /// happened when they happened, and re-deriving intervals here would score the model against
    /// a history it never lived through.</para>
    /// </summary>
    private static (double LogLoss, double Rmse) Evaluate(List<FlashcardReviewLog[]> sequences, double[] w)
    {
        double lossSum = 0, squaredSum = 0;
        var n = 0;

        foreach (var sequence in sequences)
        {
            double stability = 0, difficulty = 0;
            var state = 0;

            foreach (var log in sequence)
            {
                var rating = Math.Clamp(log.Rating, 1, 4);
                var recalled = rating >= 2;

                if (state != 0 && stability > 0)
                {
                    var predicted = FsrsService.Retrievability(stability, Math.Max(0, log.ElapsedDays));
                    if (double.IsFinite(predicted))
                    {
                        // Clamp away from 0 and 1 so a single confident miss can't send log-loss to infinity.
                        var p = Math.Clamp(predicted, 1e-6, 1 - 1e-6);
                        lossSum += recalled ? -Math.Log(p) : -Math.Log(1 - p);
                        var error = (recalled ? 1.0 : 0.0) - p;
                        squaredSum += error * error;
                        n++;
                    }
                }

                (stability, difficulty, state) = Advance(w, stability, difficulty, state, rating, log.ElapsedDays);
            }
        }

        if (n == 0) return (double.MaxValue, double.MaxValue);
        return (lossSum / n, Math.Sqrt(squaredSum / n));
    }

    /// <summary>
    /// The state transition of <see cref="FsrsService.Review"/> without the scheduling half —
    /// the optimizer only cares about (stability, difficulty, state).
    /// </summary>
    private static (double Stability, double Difficulty, int State) Advance(
        double[] w, double stability, double difficulty, int state, int rating, int elapsedDays)
    {
        double r = state != 0 && stability > 0 && elapsedDays > 0
            ? FsrsService.Retrievability(stability, elapsedDays)
            : 1.0;

        double newStability;
        double newDifficulty;
        int newState;

        switch (state)
        {
            case 0:
                newStability = FsrsService.InitialStability(w, rating);
                newDifficulty = FsrsService.InitialDifficulty(w, rating);
                newState = rating <= 2 ? 1 : 2;
                break;

            case 1:
                newDifficulty = FsrsService.UpdateDifficulty(w, difficulty, rating);
                if (rating == 1)
                {
                    newStability = FsrsService.InitialStability(w, 1);
                    newState = 1;
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, FsrsService.NextRecallStability(w, difficulty, stability, r, rating))
                        : FsrsService.InitialStability(w, rating);
                    newState = 2;
                }
                break;

            case 2:
                newDifficulty = FsrsService.UpdateDifficulty(w, difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, FsrsService.NextForgetStability(w, difficulty, stability, r));
                    newState = 3;
                }
                else
                {
                    newStability = Math.Max(0.1, FsrsService.NextRecallStability(w, difficulty, stability, r, rating));
                    newState = 2;
                }
                break;

            default:
                newDifficulty = FsrsService.UpdateDifficulty(w, difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, FsrsService.NextForgetStability(w, difficulty, stability, r));
                    newState = 3;
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, FsrsService.NextRecallStability(w, difficulty, stability, r, rating))
                        : stability;
                    newState = 2;
                }
                break;
        }

        if (!double.IsFinite(newStability) || newStability <= 0) newStability = 0.1;
        if (!double.IsFinite(newDifficulty)) newDifficulty = 5;

        return (newStability, Math.Clamp(newDifficulty, 1, 10), newState);
    }
}
