using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class FsrsParametersTests
{
    [Fact]
    public void Default_MatchesStockFsrs()
    {
        Assert.Equal(FsrsParameters.DefaultRetention, FsrsParameters.Default.DesiredRetention);
        Assert.Equal(FsrsParameters.DefaultWeights, FsrsParameters.Default.Weights);
        Assert.False(FsrsParameters.Default.EnableFuzz);
    }

    [Fact]
    public void DefaultWeights_AreInsideOptimizerBounds()
    {
        Assert.True(FsrsParameters.IsValid(FsrsParameters.DefaultWeights));
    }

    [Fact]
    public void From_NullSettings_UsesDefaultsWithFuzz()
    {
        var p = FsrsParameters.From(null);

        Assert.Equal(FsrsParameters.DefaultWeights, p.Weights);
        Assert.Equal(FsrsParameters.DefaultRetention, p.DesiredRetention);
        Assert.True(p.EnableFuzz);
    }

    [Fact]
    public void From_ClampsOutOfRangePreferences()
    {
        var p = FsrsParameters.From(new UserFsrsSettings
        {
            DesiredRetention = 0.999,
            MaximumIntervalDays = 999_999,
        });

        Assert.Equal(FsrsParameters.MaxRetention, p.DesiredRetention);
        Assert.Equal(FsrsParameters.MaxMaximumIntervalDays, p.MaximumIntervalDays);
    }

    [Fact]
    public void From_StoredWeights_AreUsed()
    {
        var custom = (double[])FsrsParameters.DefaultWeights.Clone();
        custom[0] = 0.9;

        var p = FsrsParameters.From(new UserFsrsSettings { WeightsJson = FsrsParameters.Serialize(custom) });

        Assert.Equal(0.9, p.Weights[0]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[1,2,3]")]                       // wrong length
    [InlineData("[0.4,1.1,3.1,15.4,7.2,0.5,1.0,0.05,1.5,0.15,1.0,1.9,0.11,0.29,2.27,0.21,2.98,0.51,999]")] // out of bounds
    public void ParseWeights_RejectsUnusableInput(string json)
    {
        Assert.Null(FsrsParameters.ParseWeights(json));
    }

    [Fact]
    public void ParseWeights_RoundTripsSerialize()
    {
        var parsed = FsrsParameters.ParseWeights(FsrsParameters.Serialize(FsrsParameters.DefaultWeights));

        Assert.NotNull(parsed);
        Assert.Equal(FsrsParameters.DefaultWeights, parsed);
    }
}

public class FsrsIntervalTests
{
    private static FsrsParameters Params(double retention = 0.9, int maxInterval = 36500, bool fuzz = false)
        => new(FsrsParameters.DefaultWeights, retention, maxInterval, fuzz);

    [Theory]
    [InlineData(1.0)]
    [InlineData(7.0)]
    [InlineData(42.0)]
    [InlineData(365.0)]
    public void NextInterval_AtDefaultRetention_EqualsStability(double stability)
    {
        // The pre-personalization scheduler used interval = round(stability); 0.9 retention must
        // keep reproducing it exactly, or every existing card silently reschedules.
        Assert.Equal((int)Math.Round(stability), FsrsService.NextInterval(stability, Params()));
    }

    [Fact]
    public void NextInterval_LowerRetention_SchedulesFurtherOut()
    {
        var relaxed = FsrsService.NextInterval(100, Params(retention: 0.80));
        var strict = FsrsService.NextInterval(100, Params(retention: 0.95));

        Assert.True(relaxed > 100);
        Assert.True(strict < 100);
    }

    [Fact]
    public void NextInterval_RespectsMaximumInterval()
    {
        Assert.Equal(30, FsrsService.NextInterval(500, Params(maxInterval: 30)));
    }

    [Fact]
    public void NextInterval_NeverReturnsLessThanOneDay()
    {
        Assert.Equal(1, FsrsService.NextInterval(0.01, Params(retention: FsrsParameters.MaxRetention)));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void ApplyFuzz_LeavesShortIntervalsAlone(int days)
    {
        Assert.Equal(days, FsrsService.ApplyFuzz(days, Guid.NewGuid()));
    }

    [Fact]
    public void ApplyFuzz_IsDeterministicPerCard()
    {
        var card = Guid.NewGuid();

        Assert.Equal(FsrsService.ApplyFuzz(30, card), FsrsService.ApplyFuzz(30, card));
    }

    [Fact]
    public void ApplyFuzz_StaysInsideItsBand()
    {
        // 5% of 100 days = 5, so every card must land in [95, 105].
        for (var i = 0; i < 500; i++)
        {
            var fuzzed = FsrsService.ApplyFuzz(100, Guid.NewGuid());
            Assert.InRange(fuzzed, 95, 105);
        }
    }

    [Fact]
    public void ApplyFuzz_SpreadsCardsAcrossDays()
    {
        var days = Enumerable.Range(0, 200)
            .Select(_ => FsrsService.ApplyFuzz(30, Guid.NewGuid()))
            .Distinct()
            .Count();

        // The whole point: a batch learned together must not all come due on one day.
        Assert.True(days > 1, "fuzz produced a single due date for 200 cards");
    }

    [Fact]
    public void Review_WithMaximumInterval_ClampsScheduling()
    {
        var srs = new FlashcardSrsData
        {
            FlashcardId = Guid.NewGuid(),
            State = 2, Stability = 400, Difficulty = 5, Reps = 10,
            LastReview = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };

        var result = FsrsService.Review(srs, 4, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            Params(maxInterval: 60));

        Assert.Equal(60, result.ScheduledDays);
    }

    [Fact]
    public void Review_WithoutParameters_MatchesStockBehaviour()
    {
        var srs = new FlashcardSrsData
        {
            FlashcardId = Guid.NewGuid(),
            State = 2, Stability = 10, Difficulty = 5, Reps = 3,
            LastReview = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        var at = new DateTime(2026, 1, 11, 0, 0, 0, DateTimeKind.Utc);

        var implicitDefaults = FsrsService.Review(srs, 3, at);
        var explicitDefaults = FsrsService.Review(srs, 3, at, FsrsParameters.Default);

        Assert.Equal(explicitDefaults, implicitDefaults);
    }
}
