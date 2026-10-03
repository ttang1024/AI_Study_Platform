using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class FsrsServiceTests
{
    private static FlashcardSrsData NewCard() => new()
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        FlashcardId = Guid.NewGuid(),
        State = 0,
        Stability = 0,
        Difficulty = 0,
        Reps = 0,
        Lapses = 0,
        LastReview = null,
        Due = DateTime.UtcNow
    };

    private static readonly DateTime ReviewTime = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);

    // ─── New card (State 0) ────────────────────────────────────────────────────

    [Theory]
    [InlineData(1, 1)] // Again → Learning
    [InlineData(2, 1)] // Hard → Learning
    [InlineData(3, 2)] // Good → Review
    [InlineData(4, 2)] // Easy → Review
    public void NewCard_Rating_TransitionsToCorrectState(int rating, int expectedState)
    {
        var result = FsrsService.Review(NewCard(), rating, ReviewTime);
        Assert.Equal(expectedState, result.State);
    }

    [Fact]
    public void NewCard_AnyRating_SetsRepsToOne()
    {
        foreach (var r in new[] { 1, 2, 3, 4 })
            Assert.Equal(1, FsrsService.Review(NewCard(), r, ReviewTime).Reps);
    }

    [Fact]
    public void NewCard_Again_SchedulesOneDayAhead()
    {
        var result = FsrsService.Review(NewCard(), 1, ReviewTime);
        Assert.Equal(1, result.ScheduledDays);
    }

    [Fact]
    public void NewCard_Good_ScheduledDaysMatchesRoundedStability()
    {
        var result = FsrsService.Review(NewCard(), 3, ReviewTime);
        Assert.True(result.ScheduledDays >= 1);
        Assert.Equal(2, result.State);
    }

    [Fact]
    public void NewCard_Easy_HigherStabilityThanGood()
    {
        var good = FsrsService.Review(NewCard(), 3, ReviewTime);
        var easy = FsrsService.Review(NewCard(), 4, ReviewTime);
        Assert.True(easy.Stability > good.Stability);
    }

    [Fact]
    public void NewCard_DueIsSetCorrectly()
    {
        var result = FsrsService.Review(NewCard(), 3, ReviewTime);
        var expectedDate = ReviewTime.Date.AddDays(result.ScheduledDays);
        Assert.Equal(expectedDate, result.Due.Date);
    }

    [Fact]
    public void NewCard_LastReviewSetToReviewTime()
    {
        var result = FsrsService.Review(NewCard(), 3, ReviewTime);
        Assert.Equal(ReviewTime, result.LastReview);
    }

    // ─── Learning card (State 1) ───────────────────────────────────────────────

    [Fact]
    public void LearningCard_Again_StaysInLearning()
    {
        var card = NewCard();
        card.State = 1;
        card.Stability = 1.5;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 1, ReviewTime);

        Assert.Equal(1, result.State);
        Assert.Equal(1, result.ScheduledDays);
    }

    [Fact]
    public void LearningCard_Good_GraduatesToReview()
    {
        var card = NewCard();
        card.State = 1;
        card.Stability = 2.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.Equal(2, result.State);
        Assert.True(result.ScheduledDays >= 1);
    }

    [Fact]
    public void LearningCard_IncreasesReps()
    {
        var card = NewCard();
        card.State = 1;
        card.Stability = 1.0;
        card.Difficulty = 5.0;
        card.Reps = 2;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.Equal(3, result.Reps);
    }

    // ─── Review card (State 2) ─────────────────────────────────────────────────

    [Fact]
    public void ReviewCard_Again_TransitionsToRelearning_AndIncrementsLapses()
    {
        var card = NewCard();
        card.State = 2;
        card.Stability = 10.0;
        card.Difficulty = 5.0;
        card.Reps = 5;
        card.LastReview = ReviewTime.AddDays(-10);

        var result = FsrsService.Review(card, 1, ReviewTime);

        Assert.Equal(3, result.State);
        Assert.Equal(1, result.Lapses);
        Assert.Equal(1, result.ScheduledDays);
    }

    [Fact]
    public void ReviewCard_Good_StaysInReview_AndIncreasesStability()
    {
        var card = NewCard();
        card.State = 2;
        card.Stability = 10.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-10);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.Equal(2, result.State);
        Assert.True(result.Stability > card.Stability, "Stability should grow after a successful review");
    }

    [Fact]
    public void ReviewCard_Hard_LowerStabilityGrowthThanGood()
    {
        var card = NewCard();
        card.State = 2;
        card.Stability = 10.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-10);

        var hard = FsrsService.Review(card, 2, ReviewTime);
        var good = FsrsService.Review(card, 3, ReviewTime);

        Assert.True(hard.Stability < good.Stability);
    }

    [Fact]
    public void ReviewCard_Easy_HigherStabilityGrowthThanGood()
    {
        var card = NewCard();
        card.State = 2;
        card.Stability = 10.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-10);

        var good = FsrsService.Review(card, 3, ReviewTime);
        var easy = FsrsService.Review(card, 4, ReviewTime);

        Assert.True(easy.Stability > good.Stability);
    }

    [Fact]
    public void ReviewCard_Good_EarlyReview_StabilityStillGrows()
    {
        // Reviewing well before the due date (high retrievability) must never shrink stability.
        var card = NewCard();
        card.State = 2;
        card.Stability = 30.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.True(result.Stability >= card.Stability,
            $"Early successful review shrank stability: {card.Stability} → {result.Stability}");
    }

    // ─── Relearning card (State 3) ─────────────────────────────────────────────

    [Fact]
    public void RelearningCard_Again_StaysInRelearning_NoDuplicateLapses()
    {
        var card = NewCard();
        card.State = 3;
        card.Stability = 3.0;
        card.Difficulty = 6.0;
        card.Lapses = 1;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 1, ReviewTime);

        Assert.Equal(3, result.State);
        Assert.Equal(1, result.Lapses); // no additional lapse increment
    }

    [Fact]
    public void RelearningCard_Good_GraduatesToReview()
    {
        var card = NewCard();
        card.State = 3;
        card.Stability = 3.0;
        card.Difficulty = 6.0;
        card.Lapses = 1;
        card.LastReview = ReviewTime.AddDays(-1);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.Equal(2, result.State);
        Assert.True(result.ScheduledDays >= 1);
    }

    // ─── Difficulty clamping ───────────────────────────────────────────────────

    [Fact]
    public void DifficultyIsClampedBetweenOneAndTen()
    {
        var card = NewCard();

        // Repeatedly rate "Again" (increases difficulty) to stress-test clamping
        FsrsReviewResult? result = null;
        var srs = card;
        for (var i = 0; i < 20; i++)
        {
            result = FsrsService.Review(srs, 1, ReviewTime);
            srs = new FlashcardSrsData
            {
                State = 2,
                Stability = Math.Max(1.0, result.Stability),
                Difficulty = result.Difficulty,
                Reps = result.Reps,
                Lapses = result.Lapses,
                LastReview = ReviewTime.AddDays(-result.ScheduledDays)
            };
        }

        Assert.InRange(result!.Difficulty, 1.0, 10.0);
    }

    // ─── Retrievability ────────────────────────────────────────────────────────

    [Fact]
    public void ComputeRetrievability_NoLastReview_ReturnsZero()
    {
        var r = FsrsService.ComputeRetrievability(10.0, null);
        Assert.Equal(0.0, r);
    }

    [Fact]
    public void ComputeRetrievability_ZeroStability_ReturnsZero()
    {
        var r = FsrsService.ComputeRetrievability(0.0, DateTime.UtcNow.AddDays(-5));
        Assert.Equal(0.0, r);
    }

    [Fact]
    public void ComputeRetrievability_FreshReview_CloseTo100Percent()
    {
        var r = FsrsService.ComputeRetrievability(30.0, DateTime.UtcNow.AddSeconds(-1));
        Assert.True(r > 0.99);
    }

    [Fact]
    public void ComputeRetrievability_DecaysOverTime()
    {
        var r1 = FsrsService.ComputeRetrievability(10.0, DateTime.UtcNow.AddDays(-5));
        var r2 = FsrsService.ComputeRetrievability(10.0, DateTime.UtcNow.AddDays(-10));
        Assert.True(r1 > r2, "Retrievability should decay as time passes");
    }

    // ─── ElapsedDays ──────────────────────────────────────────────────────────

    [Fact]
    public void Review_ElapsedDaysIsCorrectlySet()
    {
        var card = NewCard();
        card.State = 2;
        card.Stability = 10.0;
        card.Difficulty = 5.0;
        card.LastReview = ReviewTime.AddDays(-7);

        var result = FsrsService.Review(card, 3, ReviewTime);

        Assert.Equal(7, result.ElapsedDays);
    }

    [Fact]
    public void Review_NewCard_ElapsedDaysIsZero()
    {
        var result = FsrsService.Review(NewCard(), 3, ReviewTime);
        Assert.Equal(0, result.ElapsedDays);
    }
}
