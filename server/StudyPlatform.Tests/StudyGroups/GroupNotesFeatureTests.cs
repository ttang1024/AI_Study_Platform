using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.StudyGroups;

public class GetGroupNotesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupNoteRepository> _notes = new();
    private readonly GetGroupNotesQueryHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public GetGroupNotesQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.GroupNotes).Returns(_notes.Object);
        _handler = new GetGroupNotesQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new GetGroupNotesQuery(_groupId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_ReturnsMappedSummaries()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _notes.Setup(r => r.GetByGroupAsync(_groupId, default)).ReturnsAsync(new[]
        {
            new GroupNote { Id = Guid.NewGuid(), GroupId = _groupId, Title = "Notes", ContentPreview = "preview", CreatedBy = _userId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetGroupNotesQuery(_groupId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class GetGroupNoteQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupNoteRepository> _notes = new();
    private readonly GetGroupNoteQueryHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _noteId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public GetGroupNoteQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.GroupNotes).Returns(_notes.Object);
        _handler = new GetGroupNoteQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoteNotFound_ReturnsFailure()
    {
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync((GroupNote?)null);

        var result = await _handler.Handle(new GetGroupNoteQuery(_noteId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(new GroupNote { Id = _noteId, GroupId = _groupId });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new GetGroupNoteQuery(_noteId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_ReturnsBase64EncodedState()
    {
        var state = new byte[] { 1, 2, 3 };
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(new GroupNote { Id = _noteId, GroupId = _groupId, State = state });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);

        var result = await _handler.Handle(new GetGroupNoteQuery(_noteId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(Convert.ToBase64String(state), result.Data!.StateBase64);
    }
}

public class CreateGroupNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupNoteRepository> _notes = new();
    private readonly CreateGroupNoteCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public CreateGroupNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.GroupNotes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateGroupNoteCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new CreateGroupNoteCommand(_groupId, _userId, "Title"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AtNoteLimit_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _notes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GroupNote, bool>>>(), default)).ReturnsAsync(50);

        var result = await _handler.Handle(new CreateGroupNoteCommand(_groupId, _userId, "Title"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_NOTES", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankTitle_DefaultsToUntitled()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _notes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GroupNote, bool>>>(), default)).ReturnsAsync(0);
        _notes.Setup(r => r.AddAsync(It.IsAny<GroupNote>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateGroupNoteCommand(_groupId, _userId, "   "), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Untitled note", result.Data!.Title);
    }

    [Fact]
    public async Task Handle_ValidRequest_TrimsTitle()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _notes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GroupNote, bool>>>(), default)).ReturnsAsync(0);
        _notes.Setup(r => r.AddAsync(It.IsAny<GroupNote>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateGroupNoteCommand(_groupId, _userId, "  My Note  "), default);

        Assert.Equal("My Note", result.Data!.Title);
    }
}

public class DeleteGroupNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IGroupNoteRepository> _notes = new();
    private readonly DeleteGroupNoteCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _noteId = Guid.NewGuid();

    public DeleteGroupNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.GroupNotes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteGroupNoteCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoteNotFound_ReturnsFailure()
    {
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync((GroupNote?)null);

        var result = await _handler.Handle(new DeleteGroupNoteCommand(_noteId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NeitherCreatorNorGroupOwner_ReturnsForbidden()
    {
        var creatorId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(new GroupNote { Id = _noteId, GroupId = _groupId, CreatedBy = creatorId });
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, OwnerId = creatorId });

        var result = await _handler.Handle(new DeleteGroupNoteCommand(_noteId, otherId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Creator_CanDelete()
    {
        var creatorId = Guid.NewGuid();
        var note = new GroupNote { Id = _noteId, GroupId = _groupId, CreatedBy = creatorId };
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(note);
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, OwnerId = Guid.NewGuid() });

        var result = await _handler.Handle(new DeleteGroupNoteCommand(_noteId, creatorId), default);

        Assert.True(result.IsSuccess);
        _notes.Verify(r => r.Remove(note), Times.Once);
    }

    [Fact]
    public async Task Handle_GroupOwner_CanDeleteOthersNote()
    {
        var ownerId = Guid.NewGuid();
        var note = new GroupNote { Id = _noteId, GroupId = _groupId, CreatedBy = Guid.NewGuid() };
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(note);
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, OwnerId = ownerId });

        var result = await _handler.Handle(new DeleteGroupNoteCommand(_noteId, ownerId), default);

        Assert.True(result.IsSuccess);
        _notes.Verify(r => r.Remove(note), Times.Once);
    }
}

public class SaveGroupNoteStateCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupNoteRepository> _notes = new();
    private readonly SaveGroupNoteStateCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _noteId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public SaveGroupNoteStateCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.GroupNotes).Returns(_notes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SaveGroupNoteStateCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_StateTooLarge_ReturnsFailureWithoutTouchingRepository()
    {
        var oversized = new byte[2 * 1024 * 1024 + 1];

        var result = await _handler.Handle(new SaveGroupNoteStateCommand(_noteId, _userId, oversized, "preview"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_TOO_LARGE", result.ErrorCode);
        _notes.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NoteNotFound_ReturnsFailure()
    {
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync((GroupNote?)null);

        var result = await _handler.Handle(new SaveGroupNoteStateCommand(_noteId, _userId, new byte[] { 1 }, "preview"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOTE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(new GroupNote { Id = _noteId, GroupId = _groupId });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new SaveGroupNoteStateCommand(_noteId, _userId, new byte[] { 1 }, "preview"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidUpdate_UpdatesStateAndMetadata()
    {
        var note = new GroupNote { Id = _noteId, GroupId = _groupId, State = new byte[] { 0 }, UpdatedAt = DateTime.UtcNow.AddDays(-1) };
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(note);
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        var newState = new byte[] { 9, 9, 9 };

        var result = await _handler.Handle(new SaveGroupNoteStateCommand(_noteId, _userId, newState, "new preview"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(newState, note.State);
        Assert.Equal("new preview", note.ContentPreview);
        Assert.Equal(_userId, note.LastEditedBy);
        _notes.Verify(r => r.Update(note), Times.Once);
    }

    [Fact]
    public async Task Handle_LongPreview_TruncatesTo500Chars()
    {
        var note = new GroupNote { Id = _noteId, GroupId = _groupId, State = new byte[] { 0 } };
        _notes.Setup(r => r.GetByIdAsync(_noteId, default)).ReturnsAsync(note);
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        var longPreview = new string('x', 600);

        await _handler.Handle(new SaveGroupNoteStateCommand(_noteId, _userId, new byte[] { 1 }, longPreview), default);

        Assert.Equal(500, note.ContentPreview.Length);
    }
}
