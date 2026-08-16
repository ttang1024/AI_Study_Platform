using Moq;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GetDocumentTextQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IDocumentTextProvider> _textProvider = new();
    private readonly GetDocumentTextQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetDocumentTextQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new GetDocumentTextQueryHandler(_uow.Object, _textProvider.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentTextQuery(_userId, _documentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var doc = new Document { DocumentId = _documentId, UserId = Guid.NewGuid() };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new GetDocumentTextQuery(_userId, _documentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_ReturnsTextAndVersion()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, ContentVersion = 3 };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _textProvider.Setup(p => p.GetTextAsync(doc, default)).ReturnsAsync("Hello world");

        var result = await _handler.Handle(new GetDocumentTextQuery(_userId, _documentId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Hello world", result.Data!.Text);
        Assert.Equal(3, result.Data.ContentVersion);
    }

    [Fact]
    public async Task Handle_NoTextLayer_ReturnsNullText()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _textProvider.Setup(p => p.GetTextAsync(doc, default)).ReturnsAsync((string?)null);

        var result = await _handler.Handle(new GetDocumentTextQuery(_userId, _documentId), default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Data!.Text);
    }
}
