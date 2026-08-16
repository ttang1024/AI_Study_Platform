using Moq;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.StudyGroups;

public class CreateAssignmentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IGroupAssignmentRepository> _assignments = new();
    private readonly CreateAssignmentCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();

    public CreateAssignmentCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.GroupAssignments).Returns(_assignments.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateAssignmentCommandHandler(_uow.Object);
    }

    private StudyGroup MakeGroup(Guid userId, string role) => new()
    {
        StudyGroupId = _groupId,
        Members = new List<StudyGroupMember> { new() { UserId = userId, Role = role } },
    };

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new CreateAssignmentCommand(userId, _groupId, "Read Ch 3", null, null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GROUP_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(MakeGroup(Guid.NewGuid(), "owner"));

        var result = await _handler.Handle(new CreateAssignmentCommand(userId, _groupId, "Read Ch 3", null, null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MemberNotOwner_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(MakeGroup(userId, "member"));

        var result = await _handler.Handle(new CreateAssignmentCommand(userId, _groupId, "Read Ch 3", null, null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_OWNER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankTitle_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(MakeGroup(userId, "owner"));

        var result = await _handler.Handle(new CreateAssignmentCommand(userId, _groupId, "   ", null, null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TITLE_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_TrimsFieldsAndBlanksOutEmptyOptionals()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(MakeGroup(userId, "owner"));
        GroupAssignment? captured = null;
        _assignments.Setup(r => r.AddAsync(It.IsAny<GroupAssignment>(), default))
            .Callback<GroupAssignment, CancellationToken>((a, _) => captured = a)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(
            new CreateAssignmentCommand(userId, _groupId, "  Read Ch 3  ", "   ", "  ", null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Read Ch 3", captured!.Title);
        Assert.Null(captured.Description);
        Assert.Null(captured.LinkUrl);
    }

    [Fact]
    public async Task Handle_ReturnedDto_ReflectsGroupMemberCount()
    {
        var userId = Guid.NewGuid();
        var group = MakeGroup(userId, "owner");
        group.Members.Add(new StudyGroupMember { UserId = Guid.NewGuid(), Role = "member" });
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);
        _assignments.Setup(r => r.AddAsync(It.IsAny<GroupAssignment>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateAssignmentCommand(userId, _groupId, "Title", null, null, null), default);

        Assert.Equal(2, result.Data!.MemberCount);
        Assert.False(result.Data.CompletedByMe);
    }
}

public class GetGroupAssignmentsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IGroupAssignmentRepository> _assignments = new();
    private readonly GetGroupAssignmentsQueryHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();

    public GetGroupAssignmentsQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.GroupAssignments).Returns(_assignments.Object);
        _handler = new GetGroupAssignmentsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new GetGroupAssignmentsQuery(userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GROUP_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember>() });

        var result = await _handler.Handle(new GetGroupAssignmentsQuery(userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_MapsWhetherCurrentUserCompletedEach()
    {
        var userId = Guid.NewGuid();
        var group = new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = userId } } };
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);
        var assignment = new GroupAssignment
        {
            GroupAssignmentId = Guid.NewGuid(),
            GroupId = _groupId,
            Title = "Read Ch 3",
            Completions = new List<GroupAssignmentCompletion> { new() { UserId = userId, CompletedAt = DateTime.UtcNow } },
        };
        _assignments.Setup(r => r.GetByGroupWithCompletionsAsync(_groupId, default)).ReturnsAsync(new[] { assignment });

        var result = await _handler.Handle(new GetGroupAssignmentsQuery(userId, _groupId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Single().CompletedByMe);
    }
}

public class SetAssignmentCompletionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IGroupAssignmentRepository> _assignments = new();
    private readonly SetAssignmentCompletionCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _assignmentId = Guid.NewGuid();

    public SetAssignmentCompletionCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.GroupAssignments).Returns(_assignments.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SetAssignmentCompletionCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_AssignmentNotFound_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync((GroupAssignment?)null);

        var result = await _handler.Handle(new SetAssignmentCompletionCommand(userId, _assignmentId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ASSIGNMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, Completions = new List<GroupAssignmentCompletion>() };
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync(assignment);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember>() });

        var result = await _handler.Handle(new SetAssignmentCompletionCommand(userId, _assignmentId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MarkComplete_AddsCompletionOnce()
    {
        var userId = Guid.NewGuid();
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, Completions = new List<GroupAssignmentCompletion>() };
        var refreshed = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, Completions = new List<GroupAssignmentCompletion> { new() { UserId = userId, CompletedAt = DateTime.UtcNow } } };
        _assignments.SetupSequence(r => r.GetByIdWithCompletionsAsync(_assignmentId, default))
            .ReturnsAsync(assignment)
            .ReturnsAsync(refreshed);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = userId } } });
        _assignments.Setup(r => r.AddCompletionAsync(It.IsAny<GroupAssignmentCompletion>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SetAssignmentCompletionCommand(userId, _assignmentId, true), default);

        Assert.True(result.IsSuccess);
        _assignments.Verify(r => r.AddCompletionAsync(It.IsAny<GroupAssignmentCompletion>(), default), Times.Once);
        Assert.True(result.Data!.CompletedByMe);
    }

    [Fact]
    public async Task Handle_MarkIncomplete_RemovesExistingCompletion()
    {
        var userId = Guid.NewGuid();
        var existing = new GroupAssignmentCompletion { UserId = userId, CompletedAt = DateTime.UtcNow };
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, Completions = new List<GroupAssignmentCompletion> { existing } };
        var refreshed = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, Completions = new List<GroupAssignmentCompletion>() };
        _assignments.SetupSequence(r => r.GetByIdWithCompletionsAsync(_assignmentId, default))
            .ReturnsAsync(assignment)
            .ReturnsAsync(refreshed);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = userId } } });

        var result = await _handler.Handle(new SetAssignmentCompletionCommand(userId, _assignmentId, false), default);

        Assert.True(result.IsSuccess);
        Assert.DoesNotContain(existing, assignment.Completions);
        _assignments.Verify(r => r.AddCompletionAsync(It.IsAny<GroupAssignmentCompletion>(), default), Times.Never);
    }
}

public class DeleteAssignmentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IGroupAssignmentRepository> _assignments = new();
    private readonly DeleteAssignmentCommandHandler _handler;
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _assignmentId = Guid.NewGuid();

    public DeleteAssignmentCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.GroupAssignments).Returns(_assignments.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteAssignmentCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_AssignmentNotFound_ReturnsFailure()
    {
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync((GroupAssignment?)null);

        var result = await _handler.Handle(new DeleteAssignmentCommand(Guid.NewGuid(), _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ASSIGNMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NeitherPosterNorOwner_ReturnsForbidden()
    {
        var posterId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, CreatedByUserId = posterId };
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync(assignment);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = otherUserId, Role = "member" } } });

        var result = await _handler.Handle(new DeleteAssignmentCommand(otherUserId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Poster_CanDeleteOwnAssignment()
    {
        var posterId = Guid.NewGuid();
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, CreatedByUserId = posterId };
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync(assignment);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember>() });

        var result = await _handler.Handle(new DeleteAssignmentCommand(posterId, _assignmentId), default);

        Assert.True(result.IsSuccess);
        _assignments.Verify(r => r.Remove(assignment), Times.Once);
    }

    [Fact]
    public async Task Handle_GroupOwner_CanDeleteOthersAssignment()
    {
        var posterId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var assignment = new GroupAssignment { GroupAssignmentId = _assignmentId, GroupId = _groupId, CreatedByUserId = posterId };
        _assignments.Setup(r => r.GetByIdWithCompletionsAsync(_assignmentId, default)).ReturnsAsync(assignment);
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = ownerId, Role = "owner" } } });

        var result = await _handler.Handle(new DeleteAssignmentCommand(ownerId, _assignmentId), default);

        Assert.True(result.IsSuccess);
        _assignments.Verify(r => r.Remove(assignment), Times.Once);
    }
}
