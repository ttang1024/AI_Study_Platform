using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class CreateFlashcardCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly CreateFlashcardCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();

    public CreateFlashcardCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default)).Returns(Task.CompletedTask);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateFlashcardCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_WithoutDocument_CreatesFlashcard()
    {
        var cmd = new CreateFlashcardCommand(_userId, "Front", "Back");

        var result = await _handler.Handle(cmd, default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Front", result.Data!.Front);
        Assert.Equal("Back", result.Data.Back);
        Assert.Equal(_userId, result.Data.UserId);
        _flashcards.Verify(r => r.AddAsync(It.IsAny<Flashcard>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_WithValidDocument_CreatesFlashcard()
    {
        var docId = Guid.NewGuid();
        var doc = new Document { DocumentId = docId, UserId = _userId };
        _documents.Setup(r => r.GetByIdAsync(docId, default)).ReturnsAsync(doc);

        var cmd = new CreateFlashcardCommand(_userId, "Front", "Back", DocumentId: docId);
        var result = await _handler.Handle(cmd, default);

        Assert.True(result.IsSuccess);
        Assert.Equal(docId, result.Data!.DocumentId);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.GetByIdAsync(docId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new CreateFlashcardCommand(_userId, "F", "B", DocumentId: docId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
        _flashcards.Verify(r => r.AddAsync(It.IsAny<Flashcard>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_DocumentBelongsToDifferentUser_ReturnsFailure()
    {
        var docId = Guid.NewGuid();
        var doc = new Document { DocumentId = docId, UserId = Guid.NewGuid() }; // different owner
        _documents.Setup(r => r.GetByIdAsync(docId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new CreateFlashcardCommand(_userId, "F", "B", DocumentId: docId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WithYouTubeVideo_SetsSourceTypeToVideo()
    {
        var videoId = Guid.NewGuid();
        var cmd = new CreateFlashcardCommand(_userId, "Front", "Back", YouTubeVideoId: videoId);

        Flashcard? captured = null;
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        await _handler.Handle(cmd, default);

        Assert.Equal("video", captured?.SourceType);
        Assert.Equal(videoId, captured?.YouTubeVideoId);
    }
}

public class DeleteFlashcardCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly DeleteFlashcardCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteFlashcardCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteFlashcardCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_OwnedFlashcard_DeletesAndReturnsSuccess()
    {
        var cardId = Guid.NewGuid();
        var card = new Flashcard { FlashcardId = cardId, UserId = _userId };
        _flashcards.Setup(r => r.GetByIdAsync(cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(new DeleteFlashcardCommand(cardId, _userId), default);

        Assert.True(result.IsSuccess);
        _flashcards.Verify(r => r.Remove(card), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_FlashcardNotFound_ReturnsFailure()
    {
        _flashcards.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Flashcard?)null);

        var result = await _handler.Handle(new DeleteFlashcardCommand(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_FlashcardOwnedByOtherUser_ReturnsFailure()
    {
        var cardId = Guid.NewGuid();
        var card = new Flashcard { FlashcardId = cardId, UserId = Guid.NewGuid() };
        _flashcards.Setup(r => r.GetByIdAsync(cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(new DeleteFlashcardCommand(cardId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
        _flashcards.Verify(r => r.Remove(It.IsAny<Flashcard>()), Times.Never);
    }
}

public class GetAllFlashcardsPagedQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly GetAllFlashcardsPagedQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllFlashcardsPagedQueryHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _srsRepo.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _handler = new GetAllFlashcardsPagedQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedPagedResult()
    {
        var card = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            UserId = _userId,
            Front = "Q",
            Back = "A",
            SourceType = "document",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _flashcards
            .Setup(r => r.GetPagedByUserIdAsync(_userId, 1, 20, default))
            .ReturnsAsync((new[] { card }.AsEnumerable(), 1));

        var result = await _handler.Handle(new GetAllFlashcardsPagedQuery(_userId, 1, 20), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Items);
        Assert.Equal(1, result.Data.TotalCount);
        Assert.Equal("Q", result.Data.Items.First().Front);
    }
}

public class ReviewFlashcardCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly ReviewFlashcardCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _cardId = Guid.NewGuid();

    public ReviewFlashcardCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _srsRepo.Setup(r => r.AddAsync(It.IsAny<FlashcardSrsData>(), default)).Returns(Task.CompletedTask);
        _handler = new ReviewFlashcardCommandHandler(_uow.Object);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    public async Task Handle_InvalidRating_ReturnsFailure(int rating)
    {
        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, rating), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_RATING", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FlashcardNotFound_ReturnsFailure()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync((Flashcard?)null);

        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, 3), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FlashcardOwnedByOtherUser_ReturnsFailure()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = Guid.NewGuid() };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, 3), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NewSrs_AddsRowAndReturnsResult()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);
        _srsRepo.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync((FlashcardSrsData?)null);

        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, 3), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.ScheduledDays >= 1);
        _srsRepo.Verify(r => r.AddAsync(It.IsAny<FlashcardSrsData>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExistingSrs_DoesNotAddRow_AndReturnsResult()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        var existingSrs = new FlashcardSrsData
        {
            Id = Guid.NewGuid(), UserId = _userId, FlashcardId = _cardId,
            State = 2, Stability = 10.0, Difficulty = 5.0, Reps = 5,
            Lapses = 0, LastReview = DateTime.UtcNow.AddDays(-5), Due = DateTime.UtcNow,
        };
        _srsRepo.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync(existingSrs);

        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, 3), default);

        Assert.True(result.IsSuccess);
        _srsRepo.Verify(r => r.AddAsync(It.IsAny<FlashcardSrsData>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task Handle_AllValidRatings_ReturnSuccess(int rating)
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);
        _srsRepo.Setup(r => r.GetByUserAndFlashcardAsync(_userId, _cardId, default))
            .ReturnsAsync((FlashcardSrsData?)null);

        var result = await _handler.Handle(new ReviewFlashcardCommand(_cardId, _userId, rating), default);

        Assert.True(result.IsSuccess);
    }
}

public class ClassifyFlashcardCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly ClassifyFlashcardCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _cardId = Guid.NewGuid();

    public ClassifyFlashcardCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ClassifyFlashcardCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_FlashcardNotFound_ReturnsFailure()
    {
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync((Flashcard?)null);

        var result = await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, null, null, null, null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FLASHCARD_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UpdatesDifficulty()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId, Front = "Q", Back = "A", SourceType = "document" };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, null, null, "hard", null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("hard", card.Difficulty);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_UpdatesChapterAndTags()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId, Front = "Q", Back = "A", SourceType = "document" };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, null, null, null, "Chapter 3", new[] { "math", "algebra" }), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Chapter 3", card.Chapter);
        Assert.Contains("math", card.Tags!);
        Assert.Contains("algebra", card.Tags!);
    }

    [Fact]
    public async Task Handle_NullFields_NotApplied()
    {
        var card = new Flashcard
        {
            FlashcardId = _cardId, UserId = _userId, Front = "Q", Back = "A",
            SourceType = "document", Difficulty = "easy", Chapter = "Ch1"
        };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, null, null, null, null, null), default);

        Assert.Equal("easy", card.Difficulty);
        Assert.Equal("Ch1", card.Chapter);
    }

    [Fact]
    public async Task Handle_UpdatesFrontAndBack()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId, Front = "Old Q", Back = "Old A", SourceType = "document" };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        var result = await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, "New Q", "New A", null, null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Q", card.Front);
        Assert.Equal("New A", card.Back);
    }

    [Fact]
    public async Task Handle_EmptyChapter_SetsChapterToNull()
    {
        var card = new Flashcard { FlashcardId = _cardId, UserId = _userId, Front = "Q", Back = "A", SourceType = "document", Chapter = "Ch1" };
        _flashcards.Setup(r => r.GetByIdAsync(_cardId, default)).ReturnsAsync(card);

        await _handler.Handle(
            new ClassifyFlashcardCommand(_cardId, _userId, null, null, null, "   ", null), default);

        Assert.Null(card.Chapter);
    }
}

public class BulkDeleteFlashcardsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly BulkDeleteFlashcardsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public BulkDeleteFlashcardsCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _flashcards.Setup(r => r.DeleteByIdsAsync(It.IsAny<IEnumerable<Guid>>(), _userId, default))
            .Returns(Task.CompletedTask);
        _handler = new BulkDeleteFlashcardsCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_CallsDeleteByIdsAndSaves()
    {
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid() };

        var result = await _handler.Handle(new BulkDeleteFlashcardsCommand(ids, _userId), default);

        Assert.True(result.IsSuccess);
        _flashcards.Verify(r => r.DeleteByIdsAsync(ids, _userId, default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_EmptyList_StillSaves()
    {
        var result = await _handler.Handle(new BulkDeleteFlashcardsCommand(Array.Empty<Guid>(), _userId), default);

        Assert.True(result.IsSuccess);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}
