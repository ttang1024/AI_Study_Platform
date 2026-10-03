using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.Extensions.Logging;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class ReplaceDocumentSourceCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly Mock<ILogger<ReplaceDocumentSourceCommandHandler>> _logger = new();
    private readonly ReplaceDocumentSourceCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public ReplaceDocumentSourceCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new ReplaceDocumentSourceCommandHandler(_uow.Object, _blobStorage.Object, _mediator.Object, _logger.Object);
    }

    private static MemoryStream StreamFor(string content) => new(Encoding.UTF8.GetBytes(content));

    private static string HashOf(string content) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(content)));

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor("x"), "f.pdf", "application/pdf", 1), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var doc = new Document { DocumentId = _documentId, UserId = Guid.NewGuid() };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor("x"), "f.pdf", "application/pdf", 1), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_IdenticalFileHash_DoesNotBumpVersionAndSkipsUpload()
    {
        var content = "same content";
        var doc = new Document { DocumentId = _documentId, UserId = _userId, FileHash = HashOf(content), ContentVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _mediator.Setup(m => m.Send(It.IsAny<GetDocumentStalenessQuery>(), default))
            .ReturnsAsync(Result<StalenessDto>.Success(new StalenessDto(_documentId, 1, null, 0, 0, 0, false, false)));

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor(content), "f.pdf", "application/pdf", content.Length), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, doc.ContentVersion);
        _blobStorage.Verify(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_DifferentContent_BumpsVersionAndReplacesBlob()
    {
        var doc = new Document
        {
            DocumentId = _documentId,
            UserId = _userId,
            CourseId = Guid.NewGuid(),
            FileHash = HashOf("old content"),
            BlobUrl = "blob://old",
            ContentVersion = 1,
            Transcript = "old transcript",
            ExtractedText = "old text",
        };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("blob://new");
        _mediator.Setup(m => m.Send(It.IsAny<GetDocumentStalenessQuery>(), default))
            .ReturnsAsync(Result<StalenessDto>.Success(new StalenessDto(_documentId, 2, DateTime.UtcNow, 1, 1, 1, true, true)));

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor("new content"), "new.pdf", "application/pdf", 11), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, doc.ContentVersion);
        Assert.Equal("blob://new", doc.BlobUrl);
        Assert.Null(doc.Transcript);
        Assert.Null(doc.ExtractedText);
        _blobStorage.Verify(b => b.DeleteAsync("blob://old", default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_UploadFails_ReturnsStorageError()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileHash = HashOf("old"), ContentVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor("new content"), "new.pdf", "application/pdf", 11), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("STORAGE_ERROR", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DeleteOldBlobFails_StillReturnsSuccess()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileHash = HashOf("old"), BlobUrl = "blob://old", ContentVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("blob://new");
        _blobStorage.Setup(b => b.DeleteAsync("blob://old", default)).ThrowsAsync(new InvalidOperationException("cleanup failed"));
        _mediator.Setup(m => m.Send(It.IsAny<GetDocumentStalenessQuery>(), default))
            .ReturnsAsync(Result<StalenessDto>.Success(new StalenessDto(_documentId, 2, DateTime.UtcNow, 0, 0, 0, false, false)));

        var result = await _handler.Handle(
            new ReplaceDocumentSourceCommand(_userId, _documentId, StreamFor("new content"), "new.pdf", "application/pdf", 11), default);

        Assert.True(result.IsSuccess);
    }
}
