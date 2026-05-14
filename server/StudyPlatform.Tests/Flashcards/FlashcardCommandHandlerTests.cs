using Moq;
using StudyPlatform.Application.Flashcards.Commands;
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
