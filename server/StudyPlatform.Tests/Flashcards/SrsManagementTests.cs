using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class GetLeechFlashcardsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly GetLeechFlashcardsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetLeechFlashcardsQueryHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _handler = new GetLeechFlashcardsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsCardsWithSrsState()
    {
        var cardId = Guid.NewGuid();
        var card = new Flashcard { FlashcardId = cardId, UserId = _userId, Front = "F", Back = "B" };
        var srs = new FlashcardSrsData { FlashcardId = cardId, UserId = _userId, Lapses = 6, IsSuspended = true };
        _srs.Setup(r => r.GetLeechesByUserIdAsync(_userId, 4, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<(FlashcardSrsData, Flashcard)> { (srs, card) });

        var result = await _handler.Handle(new GetLeechFlashcardsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal(cardId, dto.FlashcardId);
        Assert.Equal(6, dto.Srs!.Lapses);
        Assert.True(dto.Srs.IsSuspended);
    }

    [Fact]
    public async Task Handle_ClampsThresholdToMinimum()
    {
        _srs.Setup(r => r.GetLeechesByUserIdAsync(_userId, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<(FlashcardSrsData, Flashcard)>());

        await _handler.Handle(new GetLeechFlashcardsQuery(_userId, Threshold: 0), default);

        _srs.Verify(r => r.GetLeechesByUserIdAsync(_userId, GetLeechFlashcardsQuery.MinThreshold, It.IsAny<CancellationToken>()), Times.Once);
    }
}

public class SetFlashcardSuspendedCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly SetFlashcardSuspendedCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _cardId = Guid.NewGuid();

    public SetFlashcardSuspendedCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SetFlashcardSuspendedCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_UnknownCard_ReturnsNotFound()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync((Flashcard?)null);

        var result = await _handler.Handle(new SetFlashcardSuspendedCommand(_cardId, _userId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CardOwnedByAnotherUser_ReturnsNotFound()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = _cardId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new SetFlashcardSuspendedCommand(_cardId, _userId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NeverReviewedCard_ReturnsFailure()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = _cardId, UserId = _userId });
        _srs.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync((FlashcardSrsData?)null);

        var result = await _handler.Handle(new SetFlashcardSuspendedCommand(_cardId, _userId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_REVIEWED", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_SuspendThenResume_TogglesFlagAndSaves()
    {
        var srsRow = new FlashcardSrsData { FlashcardId = _cardId, UserId = _userId, Lapses = 5 };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = _cardId, UserId = _userId });
        _srs.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default)).ReturnsAsync(srsRow);

        var suspend = await _handler.Handle(new SetFlashcardSuspendedCommand(_cardId, _userId, true), default);
        Assert.True(suspend.IsSuccess);
        Assert.True(srsRow.IsSuspended);
        Assert.True(suspend.Data!.IsSuspended);

        var resume = await _handler.Handle(new SetFlashcardSuspendedCommand(_cardId, _userId, false), default);
        Assert.True(resume.IsSuccess);
        Assert.False(srsRow.IsSuspended);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Exactly(2));
    }
}

public class ResetFlashcardSrsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly ResetFlashcardSrsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _cardId = Guid.NewGuid();

    public ResetFlashcardSrsCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ResetFlashcardSrsCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_UnknownCard_ReturnsNotFound()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync((Flashcard?)null);

        var result = await _handler.Handle(new ResetFlashcardSrsCommand(_cardId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoSrsRow_SucceedsWithoutRemoving()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = _cardId, UserId = _userId });
        _srs.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync((FlashcardSrsData?)null);

        var result = await _handler.Handle(new ResetFlashcardSrsCommand(_cardId, _userId), default);

        Assert.True(result.IsSuccess);
        _srs.Verify(r => r.Remove(It.IsAny<FlashcardSrsData>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ExistingSrsRow_RemovesItAndSaves()
    {
        var srsRow = new FlashcardSrsData { FlashcardId = _cardId, UserId = _userId, Reps = 12, Lapses = 6 };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = _cardId, UserId = _userId });
        _srs.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default)).ReturnsAsync(srsRow);

        var result = await _handler.Handle(new ResetFlashcardSrsCommand(_cardId, _userId), default);

        Assert.True(result.IsSuccess);
        _srs.Verify(r => r.Remove(srsRow), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}
