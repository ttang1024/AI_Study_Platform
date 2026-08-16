using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class UpdateDocumentContentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly UpdateDocumentContentCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public UpdateDocumentContentCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new UpdateDocumentContentCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new UpdateDocumentContentCommand(_documentId, _userId, "S", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var doc = new Document { DocumentId = _documentId, UserId = Guid.NewGuid() };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentContentCommand(_documentId, _userId, "S", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_SummaryProvided_UpdatesSummaryAndStampsVersion()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentVersion = 5, SummaryVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentContentCommand(_documentId, _userId, "New summary", null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New summary", doc.Summary);
        Assert.Equal(5, doc.SummaryVersion);
    }

    [Fact]
    public async Task Handle_MindMapProvided_UpdatesMindMapAndStampsVersion()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentVersion = 7, MindMapVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentContentCommand(_documentId, _userId, null, "# Map"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("# Map", doc.MindMapText);
        Assert.Equal(7, doc.MindMapVersion);
    }

    [Fact]
    public async Task Handle_NullFields_LeavesExistingValuesUnchanged()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, Summary = "Old", MindMapText = "Old map", ContentVersion = 3 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentContentCommand(_documentId, _userId, null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Old", doc.Summary);
        Assert.Equal("Old map", doc.MindMapText);
    }
}

public class ClipUrlCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly ClipUrlCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public ClipUrlCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default)).Returns(Task.CompletedTask);
        _handler = new ClipUrlCommandHandler(_uow.Object, _blobStorage.Object);
    }

    private static MemoryStream Stream() => new(new byte[] { 1, 2, 3 });

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new ClipUrlCommand(_courseId, _userId, "a.html", Stream(), 3, "text/html"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new ClipUrlCommand(_courseId, _userId, "a.html", Stream(), 3, "text/html"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UploadFails_ReturnsStorageError()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _handler.Handle(new ClipUrlCommand(_courseId, _userId, "a.html", Stream(), 3, "text/html"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("STORAGE_ERROR", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesDocumentWithOriginalUrl()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("blob://clipped");

        var result = await _handler.Handle(
            new ClipUrlCommand(_courseId, _userId, "article.html", Stream(), 3, "text/html", "https://example.com/article"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("blob://clipped", result.Data!.BlobUrl);
        Assert.Equal("https://example.com/article", result.Data.OriginalUrl);
        _documents.Verify(r => r.AddAsync(It.IsAny<Document>(), default), Times.Once);
    }
}

public class TranscribeAudioCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<ITranscriptionService> _transcription = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly TranscribeAudioCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public TranscribeAudioCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new TranscribeAudioCommandHandler(_uow.Object, _transcription.Object, _blobStorage.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new TranscribeAudioCommand(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyTranscribed_SkipsTranscriptionCall()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, Transcript = "Existing transcript", ContentType = "audio/mpeg", BlobUrl = "blob://x" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new TranscribeAudioCommand(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        _blobStorage.Verify(b => b.DownloadAsync(It.IsAny<string>(), default), Times.Never);
        _transcription.Verify(t => t.TranscribeAsync(It.IsAny<byte[]>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NotYetTranscribed_DownloadsAndTranscribes()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentType = "audio/mpeg", BlobUrl = "blob://x" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _blobStorage.Setup(b => b.DownloadAsync("blob://x", default)).ReturnsAsync(new MemoryStream(new byte[] { 1, 2, 3 }));
        _transcription.Setup(t => t.TranscribeAsync(It.IsAny<byte[]>(), "audio/mpeg", default)).ReturnsAsync("Transcribed text");

        var result = await _handler.Handle(new TranscribeAudioCommand(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Transcribed text", doc.Transcript);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class AIChatCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IChatMessageRepository> _chatMessages = new();
    private readonly Mock<IAiService> _aiService = new();
    private readonly Mock<IDocumentTextExtractor> _textExtractor = new();
    private readonly AIChatCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public AIChatCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.ChatMessages).Returns(_chatMessages.Object);
        _chatMessages.Setup(r => r.GetByDocumentIdAsync(_documentId, _userId, default)).ReturnsAsync(Array.Empty<ChatMessage>());
        _chatMessages.Setup(r => r.AddAsync(It.IsAny<ChatMessage>(), default)).Returns(Task.CompletedTask);
        _handler = new AIChatCommandHandler(_uow.Object, _aiService.Object, _textExtractor.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new AIChatCommand(_documentId, _userId, "hi"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AudioDocument_UsesTranscriptInsteadOfExtractor()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentType = "audio/mpeg", Transcript = "Some transcript", BlobUrl = "blob://x" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _aiService.Setup(a => a.ChatAsync("Some transcript", "hi", It.IsAny<IEnumerable<(string, string)>>(), default))
            .ReturnsAsync("AI response");

        var result = await _handler.Handle(new AIChatCommand(_documentId, _userId, "hi"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("AI response", result.Data!.Content);
        _textExtractor.Verify(t => t.ExtractTextAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NonAudioDocument_ExtractsTextAndCallsAi()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentType = "application/pdf", BlobUrl = "blob://x" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _textExtractor.Setup(t => t.ExtractTextAsync("blob://x", "application/pdf", default)).ReturnsAsync("Extracted content");
        _aiService.Setup(a => a.ChatAsync("Extracted content", "hi", It.IsAny<IEnumerable<(string, string)>>(), default))
            .ReturnsAsync("AI response");

        var result = await _handler.Handle(new AIChatCommand(_documentId, _userId, "hi"), default);

        Assert.True(result.IsSuccess);
        _chatMessages.Verify(r => r.AddAsync(It.IsAny<ChatMessage>(), default), Times.Exactly(2));
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}
