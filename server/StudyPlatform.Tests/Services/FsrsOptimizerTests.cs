using StudyPlatform.Application.Services;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class FsrsOptimizerTests
{
    private readonly FsrsOptimizer _optimizer = new();
    private readonly Guid _userId = Guid.NewGuid();


    [Fact]
    public void Optimize_WithTooFewReviews_ReturnsNull()
    {
        var logs = ReviewHistory.Durable(_userId, cards: 5, reviewsPerCard: 4);

        Assert.Null(_optimizer.Optimize(logs));
    }

    [Fact]
    public void Optimize_WithNoHistory_ReturnsNull()
    {
        Assert.Null(_optimizer.Optimize([]));
    }

    [Fact]
    public void Optimize_CountsOnlyScorableReviews()
    {
        // A card's first review has no prior state, so the model made no prediction to score.
        var logs = ReviewHistory.Durable(_userId, cards: 60, reviewsPerCard: 10);

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.Equal(60 * 9, result.ReviewCount);
    }

    [Fact]
    public void Optimize_ImprovesCalibrationOnMisfitHistory()
    {
        var result = _optimizer.Optimize(ReviewHistory.Durable(_userId));

        Assert.NotNull(result);
        Assert.True(result.LogLossAfter < result.LogLossBefore,
            $"expected the fit to beat the defaults, got {result.LogLossAfter} vs {result.LogLossBefore}");
        Assert.True(result.RmseAfter < result.RmseBefore);
        Assert.True(result.Improvement > 0);
    }

    [Fact]
    public void Optimize_NeverReturnsWorseWeightsThanItStartedFrom()
    {
        // Coordinate descent only ever adopts a strictly better candidate, so this must hold for
        // any history — including ones the defaults already explain well.
        var logs = ReviewHistory.Durable(_userId, cards: 40, reviewsPerCard: 8);

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.True(result.LogLossAfter <= result.LogLossBefore);
    }

    [Fact]
    public void Optimize_ReturnsWeightsInsideBounds()
    {
        var result = _optimizer.Optimize(ReviewHistory.Durable(_userId));

        Assert.NotNull(result);
        Assert.Equal(FsrsParameters.WeightCount, result.Weights.Length);
        Assert.True(FsrsParameters.IsValid(result.Weights));
    }

    [Fact]
    public void Optimize_IsDeterministic()
    {
        var logs = ReviewHistory.Durable(_userId);

        var first = _optimizer.Optimize(logs);
        var second = _optimizer.Optimize(logs);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first.Weights, second.Weights);
    }

    [Fact]
    public void Optimize_HonoursCancellation()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        Assert.Throws<OperationCanceledException>(() => _optimizer.Optimize(ReviewHistory.Durable(_userId), null, cts.Token));
    }

    [Fact]
    public void Optimize_ToleratesRatingsOutsideOneToFour()
    {
        // The log is append-only history; a bad row from an old client must not crash a fit.
        var logs = ReviewHistory.Durable(_userId);
        logs[0].Rating = 99;
        logs[1].Rating = -3;

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.True(double.IsFinite(result.LogLossAfter));
    }
}
