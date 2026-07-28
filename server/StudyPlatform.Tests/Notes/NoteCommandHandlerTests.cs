using Moq;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Notes;

public class CreateNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly CreateNoteCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _notes.Setup(r => r.AddAsync(It.IsAny<Note>(), default)).Returns(Task.CompletedTask);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateNoteCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentNote_SetsSourceTypeDocument()
    {
        var docId = Guid.NewGuid();
        var cmd = new CreateNoteCommand(_userId, "Some content", "My Note", DocumentId: docId);

        var result = await _handler.Handle(cmd, default);

        Assert.True(result.IsSuccess);
        Assert.Equal("document", result.Data!.SourceType);
        Assert.Equal(docId, result.Data.DocumentId);
        Assert.Equal("My Note", result.Data.Title);
        Assert.Equal("Some content", result.Data.Content);
    }

    [Fact]
    public async Task Handle_VideoNote_SetsSourceTypeVideo()
    {
        var videoId = Guid.NewGuid();
        var cmd = new CreateNoteCommand(_userId, "Video content", VideoId: videoId);

        var result = await _handler.Handle(cmd, default);

        Assert.True(result.IsSuccess);
        Assert.Equal("video", result.Data!.SourceType);
        Assert.Equal(videoId, result.Data.VideoId);
    }

    [Fact]
    public async Task Handle_PersistsNoteAndSavesChanges()
    {
        await _handler.Handle(new CreateNoteCommand(_userId, "content"), default);

        _notes.Verify(r => r.AddAsync(It.IsAny<Note>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class UpdateNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly UpdateNoteCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public UpdateNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateNoteCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_OwnedNote_UpdatesAndReturnsSuccess()
    {
        var noteId = Guid.NewGuid();
        var note = new Note { NoteId = noteId, UserId = _userId, Content = "old", SourceType = "document" };
        _notes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Note, bool>>>(), default))
            .ReturnsAsync(note);

        var result = await _handler.Handle(new UpdateNoteCommand(noteId, _userId, "new content", "New Title"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new content", result.Data!.Content);
        Assert.Equal("New Title", result.Data.Title);
        _notes.Verify(r => r.Update(note), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_NoteNotFound_ReturnsFailure()
    {
        _notes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Note, bool>>>(), default))
            .ReturnsAsync((Note?)null);

        var result = await _handler.Handle(new UpdateNoteCommand(Guid.NewGuid(), _userId, "content"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_NOT_FOUND", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}

public class DeleteNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IEmbeddingIndex> _embeddingIndex = new();
    private readonly DeleteNoteCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteNoteCommandHandler(_uow.Object, _embeddingIndex.Object);
    }

    [Fact]
    public async Task Handle_OwnedNote_DeletesAndReturnsSuccess()
    {
        var noteId = Guid.NewGuid();
        var note = new Note { NoteId = noteId, UserId = _userId, SourceType = "document" };
        _notes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Note, bool>>>(), default))
            .ReturnsAsync(note);

        var result = await _handler.Handle(new DeleteNoteCommand(noteId, _userId), default);

        Assert.True(result.IsSuccess);
        _notes.Verify(r => r.Remove(note), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_NoteNotFound_ReturnsFailure()
    {
        _notes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Note, bool>>>(), default))
            .ReturnsAsync((Note?)null);

        var result = await _handler.Handle(new DeleteNoteCommand(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_NOT_FOUND", result.ErrorCode);
        _notes.Verify(r => r.Remove(It.IsAny<Note>()), Times.Never);
    }
}

public class GetAllNotesPagedQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly GetAllNotesPagedQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllNotesPagedQueryHandlerTests()
    {
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _handler = new GetAllNotesPagedQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedPagedResult()
    {
        var note = new Note
        {
            NoteId = Guid.NewGuid(),
            UserId = _userId,
            Content = "Hello",
            Title = "T",
            SourceType = "document",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _notes.Setup(r => r.GetPagedByUserIdAsync(_userId, 1, 10, default))
            .ReturnsAsync((new[] { note }.AsEnumerable(), 1));

        var result = await _handler.Handle(new GetAllNotesPagedQuery(_userId, 1, 10), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.TotalCount);
        Assert.Single(result.Data.Items);
        Assert.Equal("Hello", result.Data.Items.First().Content);
    }
}

public class BulkDeleteNotesCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IEmbeddingIndex> _embeddingIndex = new();
    private readonly BulkDeleteNotesCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public BulkDeleteNotesCommandHandlerTests()
    {
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new BulkDeleteNotesCommandHandler(_uow.Object, _embeddingIndex.Object);
    }

    [Fact]
    public async Task Handle_DeletesByIdsAndReturnsSuccess()
    {
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid() };
        _notes.Setup(r => r.DeleteByIdsAsync(ids, _userId, default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new BulkDeleteNotesCommand(ids, _userId), default);

        Assert.True(result.IsSuccess);
        _notes.Verify(r => r.DeleteByIdsAsync(ids, _userId, default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}
