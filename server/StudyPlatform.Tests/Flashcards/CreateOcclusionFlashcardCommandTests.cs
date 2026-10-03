using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class CreateOcclusionFlashcardCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly CreateOcclusionFlashcardCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateOcclusionFlashcardCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default)).Returns(Task.CompletedTask);
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("https://blob/image.png");
        _handler = new CreateOcclusionFlashcardCommandHandler(_uow.Object, _blobStorage.Object);
    }

    private static CreateOcclusionFlashcardCommand MakeCommand(
        Guid userId, string contentType = "image/png", string occlusionsJson = "[{\"X\":0.1,\"Y\":0.1,\"W\":0.2,\"H\":0.2}]",
        Guid? documentId = null, string front = "", string back = "") =>
        new(userId, new MemoryStream(new byte[] { 1, 2, 3 }), "image.png", contentType, front, back, occlusionsJson, documentId);

    [Fact]
    public async Task Handle_UnsupportedContentType_ReturnsFailure()
    {
        var result = await _handler.Handle(MakeCommand(_userId, contentType: "image/bmp"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("UNSUPPORTED_IMAGE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MalformedOcclusionsJson_ReturnsFailure()
    {
        var result = await _handler.Handle(MakeCommand(_userId, occlusionsJson: "{bad"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OCCLUSIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmptyOcclusionsArray_ReturnsFailure()
    {
        var result = await _handler.Handle(MakeCommand(_userId, occlusionsJson: "[]"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_OCCLUSIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TooManyOcclusions_ReturnsFailure()
    {
        var rects = string.Join(",", Enumerable.Repeat("{\"X\":0.1,\"Y\":0.1,\"W\":0.1,\"H\":0.1}", 51));
        var result = await _handler.Handle(MakeCommand(_userId, occlusionsJson: $"[{rects}]"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_OCCLUSIONS", result.ErrorCode);
    }

    [Theory]
    [InlineData("[{\"X\":-0.1,\"Y\":0.1,\"W\":0.1,\"H\":0.1}]")]
    [InlineData("[{\"X\":0.1,\"Y\":1.1,\"W\":0.1,\"H\":0.1}]")]
    [InlineData("[{\"X\":0.1,\"Y\":0.1,\"W\":0,\"H\":0.1}]")]
    [InlineData("[{\"X\":0.1,\"Y\":0.1,\"W\":0.1,\"H\":1.5}]")]
    public async Task Handle_OutOfRangeCoordinates_ReturnsFailure(string occlusionsJson)
    {
        var result = await _handler.Handle(MakeCommand(_userId, occlusionsJson: occlusionsJson), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OCCLUSIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentIdSpecifiedButNotOwned_ReturnsFailure()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.GetByIdAsync(docId, default)).ReturnsAsync(new Document { DocumentId = docId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(MakeCommand(_userId, documentId: docId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankFront_DefaultsToPlaceholderText()
    {
        Flashcard? captured = null;
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        await _handler.Handle(MakeCommand(_userId, front: "   "), default);

        Assert.Equal("Identify the hidden parts", captured!.Front);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesOcclusionCard()
    {
        Flashcard? captured = null;
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(MakeCommand(_userId, front: "My card"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("occlusion", captured!.CardType);
        Assert.Equal("https://blob/image.png", captured.ImageUrl);
        Assert.Equal("My card", captured.Front);
    }

    [Fact]
    public async Task Handle_NormalizedJsonRoundsCoordinatesAndTrimsLabel()
    {
        Flashcard? captured = null;
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        var json = "[{\"X\":0.123456,\"Y\":0.1,\"W\":0.2,\"H\":0.2,\"Label\":\"  Heart  \"}]";
        await _handler.Handle(MakeCommand(_userId, occlusionsJson: json), default);

        Assert.Contains("0.1235", captured!.OcclusionsJson); // rounded to 4 decimals
        Assert.Contains("Heart", captured.OcclusionsJson);
        Assert.DoesNotContain("  Heart  ", captured.OcclusionsJson);
    }

    [Fact]
    public async Task Handle_FileNameWithNoExtension_InfersFromContentType()
    {
        string? capturedBlobName = null;
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<Stream, string, string, CancellationToken>((_, name, _, _) => capturedBlobName = name)
            .ReturnsAsync("https://blob/image");

        var command = new CreateOcclusionFlashcardCommand(_userId, new MemoryStream(new byte[] { 1 }), "noext", "image/webp", "", "", "[{\"X\":0.1,\"Y\":0.1,\"W\":0.1,\"H\":0.1}]");
        await _handler.Handle(command, default);

        Assert.EndsWith(".webp", capturedBlobName);
    }
}
