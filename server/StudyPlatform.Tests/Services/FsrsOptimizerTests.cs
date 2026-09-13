using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class FsrsOptimizerTests
{
    private readonly FsrsOptimizer _optimizer = new();
    private readonly Guid _userId = Guid.NewGuid();

    /// <summary>
    /// A history of cards that keep being recalled after long gaps — a learner whose real memory
    /// is far more durable than the stock weights assume, which is exactly what a fit should catch.
    /// </summary>
    private List<FlashcardReviewLog> DurableHistory(int cards = 60, int reviewsPerCard = 10)
    {
        var logs = new List<FlashcardReviewLog>();
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        for (var c = 0; c < cards; c++)
        {
            var cardId = Guid.NewGuid();
            var at = start;

            for (var i = 0; i < reviewsPerCard; i++)
            {
                var elapsed = i == 0 ? 0 : 10 + i * 10;
                at = at.AddDays(elapsed);
                logs.Add(new FlashcardReviewLog
                {
                    Id = Guid.NewGuid(),
                    UserId = _userId,
                    FlashcardId = cardId,
                    Rating = 3,
                    StateBefore = i == 0 ? 0 : 2,
                    ElapsedDays = elapsed,
                    ReviewedAt = at,
                });
            }
        }

        return logs;
    }

    [Fact]
    public void Optimize_WithTooFewReviews_ReturnsNull()
    {
        var logs = DurableHistory(cards: 5, reviewsPerCard: 4);

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
        var logs = DurableHistory(cards: 60, reviewsPerCard: 10);

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.Equal(60 * 9, result.ReviewCount);
    }

    [Fact]
    public void Optimize_ImprovesCalibrationOnMisfitHistory()
    {
        var result = _optimizer.Optimize(DurableHistory());

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
        var logs = DurableHistory(cards: 40, reviewsPerCard: 8);

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.True(result.LogLossAfter <= result.LogLossBefore);
    }

    [Fact]
    public void Optimize_ReturnsWeightsInsideBounds()
    {
        var result = _optimizer.Optimize(DurableHistory());

        Assert.NotNull(result);
        Assert.Equal(FsrsParameters.WeightCount, result.Weights.Length);
        Assert.True(FsrsParameters.IsValid(result.Weights));
    }

    [Fact]
    public void Optimize_IsDeterministic()
    {
        var logs = DurableHistory();

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

        Assert.Throws<OperationCanceledException>(() => _optimizer.Optimize(DurableHistory(), null, cts.Token));
    }

    [Fact]
    public void Optimize_ToleratesRatingsOutsideOneToFour()
    {
        // The log is append-only history; a bad row from an old client must not crash a fit.
        var logs = DurableHistory();
        logs[0].Rating = 99;
        logs[1].Rating = -3;

        var result = _optimizer.Optimize(logs);

        Assert.NotNull(result);
        Assert.True(double.IsFinite(result.LogLossAfter));
    }
}
