using System.Text.Json;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Everything the scheduler needs beyond the card itself: the 19 FSRS weights plus the
/// user's scheduling preferences. <see cref="Default"/> reproduces stock FSRS-4.5 behaviour
/// exactly, so callers that don't care about personalization can ignore this type.
/// </summary>
public sealed record FsrsParameters(
    double[] Weights,
    double DesiredRetention,
    int MaximumIntervalDays,
    bool EnableFuzz)
{
    public const int WeightCount = 19;

    public const double DefaultRetention = 0.9;
    public const double MinRetention = 0.70;
    public const double MaxRetention = 0.98;

    public const int DefaultMaximumIntervalDays = 36500;
    public const int MaxMaximumIntervalDays = 36500;

    public const int DefaultNewCardsPerDay = 20;
    public const int MaxNewCardsPerDay = 9999;
    public const int MaxReviewsPerDayCeiling = 9999;

    /// <summary>Stock FSRS-4.5 weights, the starting point for optimization.</summary>
    public static readonly double[] DefaultWeights =
    [
        0.4072, 1.1829, 3.1262, 15.4722,
        7.2102, 0.5316, 1.0651, 0.0589,
        1.5330, 0.1544, 1.0070, 1.9395,
        0.1100, 0.2900, 2.2700, 0.2100,
        2.9898, 0.5100, 0.3400
    ];

    /// <summary>
    /// Per-weight bounds the optimizer searches inside. They keep a fit from wandering into
    /// regions where the formulas stop being meaningful (negative stability, difficulty outside 1–10).
    /// </summary>
    public static readonly (double Min, double Max)[] WeightBounds =
    [
        (0.01, 100), (0.01, 100), (0.01, 100), (0.01, 100),
        (1.0, 10.0), (0.01, 5.0), (0.01, 5.0), (0.0, 0.75),
        (0.0, 4.0), (0.0, 0.8), (0.01, 3.5), (0.1, 5.0),
        (0.01, 0.25), (0.01, 0.9), (0.01, 4.0), (0.0, 1.0),
        (1.0, 6.0), (0.0, 2.0), (0.0, 2.0)
    ];

    public static FsrsParameters Default { get; } =
        new(DefaultWeights, DefaultRetention, DefaultMaximumIntervalDays, EnableFuzz: false);

    /// <summary>
    /// Build the effective parameters for a user. A null settings row — the common case for
    /// someone who never opened the scheduler settings — means stock FSRS with fuzz on, since
    /// fuzz is a default-on behaviour for new rows.
    /// </summary>
    public static FsrsParameters From(UserFsrsSettings? settings)
    {
        if (settings == null) return Default with { EnableFuzz = true };

        return new FsrsParameters(
            ParseWeights(settings.WeightsJson) ?? DefaultWeights,
            Math.Clamp(settings.DesiredRetention, MinRetention, MaxRetention),
            Math.Clamp(settings.MaximumIntervalDays, 1, MaxMaximumIntervalDays),
            settings.EnableFuzz);
    }

    /// <summary>
    /// Read a stored weight array. Anything malformed — wrong length, non-finite, out of bounds —
    /// is treated as absent rather than an error: a corrupt row must not break reviewing.
    /// </summary>
    public static double[]? ParseWeights(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var w = JsonSerializer.Deserialize<double[]>(json);
            return IsValid(w) ? w : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static bool IsValid(double[]? w)
    {
        if (w is not { Length: WeightCount }) return false;
        for (var i = 0; i < WeightCount; i++)
        {
            if (!double.IsFinite(w[i])) return false;
            if (w[i] < WeightBounds[i].Min || w[i] > WeightBounds[i].Max) return false;
        }
        return true;
    }

    public static string Serialize(double[] weights)
        => JsonSerializer.Serialize(weights.Select(x => Math.Round(x, 4)).ToArray());

    public static double[] Clamp(double[] w)
    {
        var clamped = new double[WeightCount];
        for (var i = 0; i < WeightCount; i++)
            clamped[i] = Math.Clamp(w[i], WeightBounds[i].Min, WeightBounds[i].Max);
        return clamped;
    }
}
