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
/// </summary>
public static class FsrsService
{
    private static readonly double[] W =
    [
        0.4072, 1.1829, 3.1262, 15.4722,
        7.2102, 0.5316, 1.0651, 0.0589,
        1.5330, 0.1544, 1.0070, 1.9395,
        0.1100, 0.2900, 2.2700, 0.2100,
        2.9898, 0.5100, 0.3400
    ];

    private const double Factor = 19.0 / 81.0;
    private const double Decay = -0.5;

    public static FsrsReviewResult Review(FlashcardSrsData srs, int rating, DateTime reviewedAt)
    {
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
                newStability = InitialStability(rating);
                newDifficulty = InitialDifficulty(rating);
                if (rating <= 2)
                {
                    newState = 1; // Learning
                    scheduledDays = 1;
                }
                else
                {
                    newState = 2; // Review
                    scheduledDays = (int)Math.Max(1, Math.Round(newStability));
                }
                break;

            case 1: // Learning
                newDifficulty = UpdateDifficulty(srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = InitialStability(1);
                    newState = 1;
                    scheduledDays = 1;
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, NextRecallStability(srs.Difficulty, srs.Stability, r, rating))
                        : InitialStability(rating);
                    newState = 2;
                    scheduledDays = (int)Math.Max(1, Math.Round(newStability));
                }
                break;

            case 2: // Review
                newDifficulty = UpdateDifficulty(srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, NextForgetStability(srs.Difficulty, srs.Stability, r));
                    newState = 3;
                    scheduledDays = 1;
                    lapses++;
                }
                else
                {
                    newStability = Math.Max(0.1, NextRecallStability(srs.Difficulty, srs.Stability, r, rating));
                    newState = 2;
                    scheduledDays = (int)Math.Max(1, Math.Round(newStability));
                }
                break;

            default: // Relearning (State == 3)
                newDifficulty = UpdateDifficulty(srs.Difficulty, rating);
                if (rating == 1)
                {
                    newStability = Math.Max(0.1, NextForgetStability(srs.Difficulty, srs.Stability, r));
                    newState = 3;
                    scheduledDays = 1;
                    lapses++;
                }
                else
                {
                    newStability = elapsedDays > 0
                        ? Math.Max(0.1, NextRecallStability(srs.Difficulty, srs.Stability, r, rating))
                        : srs.Stability;
                    newState = 2;
                    scheduledDays = (int)Math.Max(1, Math.Round(newStability));
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
            Due: reviewedAt.Date.AddDays(scheduledDays),
            LastReview: reviewedAt,
            Retrievability: Math.Round(r, 4));
    }

    public static double ComputeRetrievability(double stability, DateTime? lastReview)
    {
        if (!lastReview.HasValue || stability <= 0) return 0;
        var elapsed = (DateTime.UtcNow - lastReview.Value).TotalDays;
        return elapsed >= 0 ? Math.Round(Retrievability(stability, elapsed), 4) : 1.0;
    }

    private static double InitialStability(int rating) => W[rating - 1];

    private static double InitialDifficulty(int rating)
        => W[4] - Math.Exp(W[5] * (rating - 1)) + 1;

    private static double Retrievability(double stability, double elapsedDays)
        => Math.Pow(1 + Factor * elapsedDays / stability, Decay);

    private static double NextRecallStability(double d, double s, double r, int g)
    {
        double hardPenalty = g == 2 ? W[15] : 1.0;
        double easyBonus = g == 4 ? W[16] : 1.0;
        return s * Math.Exp(W[8]) * (11 - d)
               * Math.Pow(s, -W[9])
               * (Math.Exp(W[10] * (1 - r)) - 1)
               * hardPenalty * easyBonus;
    }

    private static double NextForgetStability(double d, double s, double r)
        => W[11] * Math.Pow(d, -W[12])
           * (Math.Pow(s + 1, W[13]) - 1)
           * Math.Exp(W[14] * (1 - r));

    private static double UpdateDifficulty(double d, int g)
    {
        double deltaD = -W[6] * (g - 3);
        double dNew = d + deltaD * ((10.0 - d) / 9.0);
        double d04 = W[4] - Math.Exp(W[5] * 3) + 1;
        dNew = W[7] * d04 + (1 - W[7]) * dNew;
        return dNew;
    }
}
