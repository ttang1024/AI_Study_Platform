using Moq;
using StudyPlatform.Application.Annotations;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Annotations;

public class GetAnnotationsByDocumentQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentAnnotationRepository> _annotations = new();
    private readonly GetAnnotationsByDocumentQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetAnnotationsByDocumentQueryHandlerTests()
    {
        _uow.Setup(u => u.DocumentAnnotations).Returns(_annotations.Object);
        _handler = new GetAnnotationsByDocumentQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsAnnotationsToDtos()
    {
        var annotation = new DocumentAnnotation
        {
            DocumentAnnotationId = Guid.NewGuid(),
            DocumentId = _documentId,
            UserId = _userId,
            HighlightedText = "text",
            Color = "#FFFF00",
            RectJson = "[]",
        };
        _annotations.Setup(r => r.GetByDocumentAsync(_documentId, _userId, default)).ReturnsAsync(new[] { annotation });

        var result = await _handler.Handle(new GetAnnotationsByDocumentQuery(_userId, _documentId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class CreateAnnotationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IDocumentAnnotationRepository> _annotations = new();
    private readonly CreateAnnotationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public CreateAnnotationCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.DocumentAnnotations).Returns(_annotations.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _annotations.Setup(r => r.AddAsync(It.IsAny<DocumentAnnotation>(), default)).Returns(Task.CompletedTask);
        _handler = new CreateAnnotationCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new CreateAnnotationCommand(_userId, _documentId, "text", null, "#fff", 1, "[]"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentOwnedByOtherUser_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new CreateAnnotationCommand(_userId, _documentId, "text", null, "#fff", 1, "[]"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankColor_DefaultsToYellow()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId });

        var result = await _handler.Handle(new CreateAnnotationCommand(_userId, _documentId, "text", null, "  ", 1, "[]"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("#FFFF00", result.Data!.Color);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesAnnotation()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId });

        var result = await _handler.Handle(new CreateAnnotationCommand(_userId, _documentId, "highlighted", "note", "#00FF00", 3, "[{}]"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("highlighted", result.Data!.HighlightedText);
        Assert.Equal(3, result.Data.PageNumber);
    }
}

public class UpdateAnnotationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentAnnotationRepository> _annotations = new();
    private readonly UpdateAnnotationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _annotationId = Guid.NewGuid();

    public UpdateAnnotationCommandHandlerTests()
    {
        _uow.Setup(u => u.DocumentAnnotations).Returns(_annotations.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateAnnotationCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFoundOrNotOwned_ReturnsFailure()
    {
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default)).ReturnsAsync((DocumentAnnotation?)null);

        var result = await _handler.Handle(new UpdateAnnotationCommand(_userId, _annotationId, "note", "#fff"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ANNOTATION_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankColor_KeepsExistingColor()
    {
        var annotation = new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = _userId, Color = "#00FF00" };
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default)).ReturnsAsync(annotation);

        var result = await _handler.Handle(new UpdateAnnotationCommand(_userId, _annotationId, "new note", "  "), default);

        Assert.Equal("#00FF00", result.Data!.Color);
    }

    [Fact]
    public async Task Handle_ValidRequest_UpdatesNoteAndColor()
    {
        var annotation = new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = _userId, Color = "#00FF00" };
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default)).ReturnsAsync(annotation);

        var result = await _handler.Handle(new UpdateAnnotationCommand(_userId, _annotationId, "new note", "#0000FF"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new note", result.Data!.Note);
        Assert.Equal("#0000FF", result.Data.Color);
        _annotations.Verify(r => r.Update(annotation), Times.Once);
    }
}

public class DeleteAnnotationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentAnnotationRepository> _annotations = new();
    private readonly DeleteAnnotationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _annotationId = Guid.NewGuid();

    public DeleteAnnotationCommandHandlerTests()
    {
        _uow.Setup(u => u.DocumentAnnotations).Returns(_annotations.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteAnnotationCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default))
            .ReturnsAsync(new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new DeleteAnnotationCommand(_userId, _annotationId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ANNOTATION_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_DeletesSuccessfully()
    {
        var annotation = new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = _userId };
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default)).ReturnsAsync(annotation);

        var result = await _handler.Handle(new DeleteAnnotationCommand(_userId, _annotationId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _annotations.Verify(r => r.Remove(annotation), Times.Once);
    }
}

public class CreateFlashcardFromAnnotationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentAnnotationRepository> _annotations = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly CreateFlashcardFromAnnotationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _annotationId = Guid.NewGuid();

    public CreateFlashcardFromAnnotationCommandHandlerTests()
    {
        _uow.Setup(u => u.DocumentAnnotations).Returns(_annotations.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateFlashcardFromAnnotationCommandHandler(_uow.Object, _ai.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default))
            .ReturnsAsync(new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new CreateFlashcardFromAnnotationCommand(_userId, _annotationId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ANNOTATION_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidAnnotation_CreatesFlashcardFromHighlightedText()
    {
        var docId = Guid.NewGuid();
        var annotation = new DocumentAnnotation { DocumentAnnotationId = _annotationId, UserId = _userId, DocumentId = docId, HighlightedText = "Photosynthesis" };
        _annotations.Setup(r => r.GetByIdAsync(_annotationId, default)).ReturnsAsync(annotation);
        _ai.Setup(a => a.GenerateFlashcardBackAsync("Photosynthesis", default)).ReturnsAsync("  Converts light to energy  ");
        Flashcard? captured = null;
        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => captured = f)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateFlashcardFromAnnotationCommand(_userId, _annotationId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Photosynthesis", captured!.Front);
        Assert.Equal("Converts light to energy", captured.Back);
        Assert.Equal(docId, captured.DocumentId);
    }
}
