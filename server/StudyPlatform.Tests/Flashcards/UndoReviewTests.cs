using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class UndoLastReviewCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly Mock<IFlashcardReviewLogRepository> _reviewLogs = new();
    private readonly UndoLastReviewCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _cardId = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

    public UndoLastReviewCommandHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _uow.Setup(u => u.FlashcardReviewLogs).Returns(_reviewLogs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UndoLastReviewCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_WithNoReviews_ReturnsFailure()
    {
        _reviewLogs.Setup(r => r.GetLatestAsync(_userId, null, default)).ReturnsAsync((FlashcardReviewLog?)null);

        var result = await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_REVIEW_TO_UNDO", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_RestoresExactPreReviewState()
    {
        var srs = CurrentSrs(state: 2, stability: 40, difficulty: 6.5, reps: 4, lapses: 1);
        var previous = Log(at: Now.AddDays(-10), rating: 3, stateBefore: 2, scheduledDays: 10);
        Latest(Log(at: Now, rating: 4, stateBefore: 2, stabilityBefore: 12.5, difficultyBefore: 5.25), previous);

        var result = await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.CardReset);
        Assert.Equal(4, result.Data.Rating);
        Assert.Equal(2, srs.State);
        Assert.Equal(12.5, srs.Stability);
        Assert.Equal(5.25, srs.Difficulty);
        Assert.Equal(3, srs.Reps);
        // The undone review was an "Easy", so it never cost a lapse — the count must not move.
        Assert.Equal(1, srs.Lapses);
    }

    [Fact]
    public async Task Handle_RestoresDueDateFromThePrecedingReview()
    {
        var srs = CurrentSrs(state: 2, stability: 40, difficulty: 6, reps: 4);
        var previous = Log(at: Now.AddDays(-10), rating: 3, stateBefore: 2, scheduledDays: 10, elapsedDays: 7);
        Latest(Log(at: Now, rating: 3, stateBefore: 2), previous);

        await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        // Due again where the previous review put it: 10 days after that review, i.e. today.
        Assert.Equal(Now.Date, srs.Due.Date);
        Assert.Equal(10, srs.ScheduledDays);
        Assert.Equal(7, srs.ElapsedDays);
        Assert.Equal(previous.ReviewedAt, srs.LastReview);
        Assert.Equal(DateTimeKind.Utc, srs.Due.Kind);
    }

    [Fact]
    public async Task Handle_UndoingALapse_GivesTheLapseBack()
    {
        var srs = CurrentSrs(state: 3, stability: 3, difficulty: 7, reps: 5, lapses: 2);
        Latest(Log(at: Now, rating: 1, stateBefore: 2), Log(at: Now.AddDays(-5), rating: 3, stateBefore: 2));

        await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.Equal(1, srs.Lapses);
    }

    [Fact]
    public async Task Handle_AgainInRelearning_DoesNotTouchLapses()
    {
        // Lapses are counted only on the Review → Relearning transition, so undoing an "Again"
        // that was already in relearning must leave the count alone.
        var srs = CurrentSrs(state: 3, stability: 2, difficulty: 7, reps: 6, lapses: 2);
        Latest(Log(at: Now, rating: 1, stateBefore: 3), Log(at: Now.AddDays(-1), rating: 1, stateBefore: 2));

        await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.Equal(2, srs.Lapses);
    }

    [Fact]
    public async Task Handle_FirstEverReview_ResetsTheCardToNew()
    {
        var srs = CurrentSrs(state: 2, stability: 3, difficulty: 5, reps: 1);
        Latest(Log(at: Now, rating: 3, stateBefore: 0), previous: null);

        var result = await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.CardReset);
        Assert.Null(result.Data.Srs);
        _srsRepo.Verify(r => r.Remove(srs), Times.Once);
    }

    [Fact]
    public async Task Handle_AlwaysDeletesTheLogRow()
    {
        CurrentSrs(state: 2, stability: 40, difficulty: 6, reps: 4);
        var latest = Log(at: Now, rating: 3, stateBefore: 2);
        Latest(latest, Log(at: Now.AddDays(-5), rating: 3, stateBefore: 2));

        await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        // Deleting it is what makes undo repeatable — a second call rolls back the one before.
        _reviewLogs.Verify(r => r.Remove(latest), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_ScopedToOneCard_LooksUpThatCard()
    {
        CurrentSrs(state: 2, stability: 40, difficulty: 6, reps: 4);
        _reviewLogs.Setup(r => r.GetLatestAsync(_userId, _cardId, default))
            .ReturnsAsync(Log(at: Now, rating: 3, stateBefore: 2));
        _reviewLogs.Setup(r => r.GetPreviousAsync(_userId, _cardId, Now, default))
            .ReturnsAsync(Log(at: Now.AddDays(-5), rating: 3, stateBefore: 2));

        var result = await _handler.Handle(new UndoLastReviewCommand(_userId, _cardId), default);

        Assert.True(result.IsSuccess);
        _reviewLogs.Verify(r => r.GetLatestAsync(_userId, _cardId, default), Times.Once);
    }

    [Fact]
    public async Task Handle_WithoutAnSrsRow_StillDropsTheLog()
    {
        // The row can already be gone if the card's scheduling was reset between review and undo.
        _srsRepo.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync((FlashcardSrsData?)null);
        var latest = Log(at: Now, rating: 3, stateBefore: 2);
        Latest(latest, Log(at: Now.AddDays(-5), rating: 3, stateBefore: 2));

        var result = await _handler.Handle(new UndoLastReviewCommand(_userId), default);

        Assert.True(result.IsSuccess);
        _reviewLogs.Verify(r => r.Remove(latest), Times.Once);
    }

    private FlashcardSrsData CurrentSrs(int state, double stability, double difficulty, int reps, int lapses = 0)
    {
        var srs = new FlashcardSrsData
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            FlashcardId = _cardId,
            State = state,
            Stability = stability,
            Difficulty = difficulty,
            Reps = reps,
            Lapses = lapses,
            LastReview = Now,
            Due = Now.AddDays(30),
        };
        _srsRepo.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default)).ReturnsAsync(srs);
        return srs;
    }

    private FlashcardReviewLog Log(
        DateTime at, int rating, int stateBefore,
        double stabilityBefore = 10, double difficultyBefore = 5,
        int scheduledDays = 10, int elapsedDays = 5)
        => new()
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            FlashcardId = _cardId,
            Rating = rating,
            StateBefore = stateBefore,
            StabilityBefore = stabilityBefore,
            DifficultyBefore = difficultyBefore,
            ScheduledDays = scheduledDays,
            ElapsedDays = elapsedDays,
            ReviewedAt = at,
        };

    private void Latest(FlashcardReviewLog latest, FlashcardReviewLog? previous)
    {
        _reviewLogs.Setup(r => r.GetLatestAsync(_userId, null, default)).ReturnsAsync(latest);
        _reviewLogs.Setup(r => r.GetPreviousAsync(_userId, _cardId, latest.ReviewedAt, default)).ReturnsAsync(previous);
    }
}
