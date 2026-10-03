using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.StudyGroups;

public class GetMyGroupsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly GetMyGroupsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMyGroupsQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _handler = new GetMyGroupsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMemberAndSharedCourseCounts()
    {
        var group = new StudyGroup
        {
            StudyGroupId = Guid.NewGuid(),
            Name = "Study Buddies",
            InviteCode = "ABC12345",
            CreatedAt = DateTime.UtcNow,
            Members = new List<StudyGroupMember> { new(), new() },
            SharedCourses = new List<StudyGroupSharedCourse> { new() },
        };
        _groups.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[] { group });

        var result = await _handler.Handle(new GetMyGroupsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal(2, dto.MemberCount);
        Assert.Equal(1, dto.SharedCourseCount);
    }
}

public class GetGroupDetailQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly GetGroupDetailQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public GetGroupDetailQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _handler = new GetGroupDetailQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new GetGroupDetailQuery(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsForbidden()
    {
        var group = new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember>() };
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);

        var result = await _handler.Handle(new GetGroupDetailQuery(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_ReturnsDetail()
    {
        var user = new User { UserId = _userId, FullName = "Ada" };
        var group = new StudyGroup
        {
            StudyGroupId = _groupId,
            Name = "Study Buddies",
            Members = new List<StudyGroupMember>
            {
                new() { UserId = _userId, User = user, Role = "owner", JoinedAt = DateTime.UtcNow },
            },
            SharedCourses = new List<StudyGroupSharedCourse>(),
        };
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);

        var result = await _handler.Handle(new GetGroupDetailQuery(_userId, _groupId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Members);
    }
}

public class GetGroupChatQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupChatMessageRepository> _messages = new();
    private readonly GetGroupChatQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public GetGroupChatQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.GroupChatMessages).Returns(_messages.Object);
        _handler = new GetGroupChatQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new GetGroupChatQuery(_userId, _groupId, 1), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsForbidden()
    {
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(new StudyGroup { StudyGroupId = _groupId });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new GetGroupChatQuery(_userId, _groupId, 1), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_ReturnsMappedMessages()
    {
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(new StudyGroup { StudyGroupId = _groupId });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        var user = new User { UserId = _userId, FullName = "Ada" };
        _messages.Setup(r => r.GetByGroupAsync(_groupId, 50, null, default))
            .ReturnsAsync(new[] { new GroupChatMessage { GroupChatMessageId = Guid.NewGuid(), UserId = _userId, User = user, Content = "hi", SentAt = DateTime.UtcNow } });

        var result = await _handler.Handle(new GetGroupChatQuery(_userId, _groupId, 1), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Ada", result.Data!.First().UserName);
    }
}

public class CreateStudyGroupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly CreateStudyGroupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateStudyGroupCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateStudyGroupCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_CreatesGroupAndOwnerMembership()
    {
        StudyGroup? capturedGroup = null;
        StudyGroupMember? capturedMember = null;
        _groups.Setup(r => r.AddAsync(It.IsAny<StudyGroup>(), default))
            .Callback<StudyGroup, CancellationToken>((g, _) => capturedGroup = g)
            .Returns(Task.CompletedTask);
        _members.Setup(r => r.AddAsync(It.IsAny<StudyGroupMember>(), default))
            .Callback<StudyGroupMember, CancellationToken>((m, _) => capturedMember = m)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateStudyGroupCommand(_userId, "Study Buddies", "CS 101"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Study Buddies", result.Data!.Name);
        Assert.Equal(1, result.Data.MemberCount);
        Assert.Equal(0, result.Data.SharedCourseCount);
        Assert.Equal(8, capturedGroup!.InviteCode.Length);
        Assert.Equal(_userId, capturedGroup.OwnerId);
        Assert.Equal("owner", capturedMember!.Role);
        Assert.Equal(capturedGroup.StudyGroupId, capturedMember.GroupId);
    }

    [Fact]
    public async Task Handle_GeneratesDistinctInviteCodesAcrossCalls()
    {
        _groups.Setup(r => r.AddAsync(It.IsAny<StudyGroup>(), default)).Returns(Task.CompletedTask);
        _members.Setup(r => r.AddAsync(It.IsAny<StudyGroupMember>(), default)).Returns(Task.CompletedTask);

        var codes = new HashSet<string>();
        for (var i = 0; i < 5; i++)
        {
            var result = await _handler.Handle(new CreateStudyGroupCommand(_userId, "Group", null), default);
            codes.Add(result.Data!.InviteCode);
        }

        Assert.Equal(5, codes.Count);
    }
}

public class JoinStudyGroupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly JoinStudyGroupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public JoinStudyGroupCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new JoinStudyGroupCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_InvalidInviteCode_ReturnsFailure()
    {
        _groups.Setup(r => r.GetByInviteCodeAsync("BADCODE", default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new JoinStudyGroupCommand(_userId, "BADCODE"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_INVITE_CODE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyMember_ReturnsFailure()
    {
        var group = new StudyGroup
        {
            StudyGroupId = Guid.NewGuid(),
            InviteCode = "ABC12345",
            Members = new List<StudyGroupMember> { new() { UserId = _userId } },
        };
        _groups.Setup(r => r.GetByInviteCodeAsync("ABC12345", default)).ReturnsAsync(group);

        var result = await _handler.Handle(new JoinStudyGroupCommand(_userId, "ABC12345"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NewMember_AddsMembershipAndReturnsDto()
    {
        var group = new StudyGroup
        {
            StudyGroupId = Guid.NewGuid(),
            Name = "Study Buddies",
            InviteCode = "ABC12345",
            Members = new List<StudyGroupMember>(),
            SharedCourses = new List<StudyGroupSharedCourse>(),
        };
        _groups.Setup(r => r.GetByInviteCodeAsync("ABC12345", default)).ReturnsAsync(group);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, FullName = "Ada" });
        _members.Setup(r => r.AddAsync(It.IsAny<StudyGroupMember>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new JoinStudyGroupCommand(_userId, "ABC12345"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("member", result.Data!.Member.Role);
        Assert.Equal("Ada", result.Data.Member.UserName);
        _members.Verify(r => r.AddAsync(It.IsAny<StudyGroupMember>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_UserRecordMissing_FallsBackToUnknownName()
    {
        var group = new StudyGroup
        {
            StudyGroupId = Guid.NewGuid(),
            InviteCode = "ABC12345",
            Members = new List<StudyGroupMember>(),
            SharedCourses = new List<StudyGroupSharedCourse>(),
        };
        _groups.Setup(r => r.GetByInviteCodeAsync("ABC12345", default)).ReturnsAsync(group);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);
        _members.Setup(r => r.AddAsync(It.IsAny<StudyGroupMember>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new JoinStudyGroupCommand(_userId, "ABC12345"), default);

        Assert.Equal("Unknown", result.Data!.Member.UserName);
    }
}

public class LeaveStudyGroupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly LeaveStudyGroupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public LeaveStudyGroupCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new LeaveStudyGroupCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotAMember_ReturnsFailure()
    {
        _members.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync((StudyGroupMember?)null);

        var result = await _handler.Handle(new LeaveStudyGroupCommand(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owner_CannotLeave()
    {
        _members.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(new StudyGroupMember { UserId = _userId, GroupId = _groupId, Role = "owner" });

        var result = await _handler.Handle(new LeaveStudyGroupCommand(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("OWNER_CANNOT_LEAVE", result.ErrorCode);
        _members.Verify(r => r.Remove(It.IsAny<StudyGroupMember>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RegularMember_RemovesAndSucceeds()
    {
        var member = new StudyGroupMember { UserId = _userId, GroupId = _groupId, Role = "member" };
        _members.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(member);

        var result = await _handler.Handle(new LeaveStudyGroupCommand(_userId, _groupId), default);

        Assert.True(result.IsSuccess);
        _members.Verify(r => r.Remove(member), Times.Once);
    }
}

public class RemoveGroupMemberCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly RemoveGroupMemberCommandHandler _handler;
    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid _targetId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly List<StudyGroupMember> _store = new();

    public RemoveGroupMemberCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _members.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync((Expression<Func<StudyGroupMember, bool>> predicate, CancellationToken _) =>
                _store.FirstOrDefault(predicate.Compile()));
        _handler = new RemoveGroupMemberCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_CallerNotOwner_ReturnsForbidden()
    {
        _store.Add(new StudyGroupMember { UserId = _ownerId, GroupId = _groupId, Role = "member" });

        var result = await _handler.Handle(new RemoveGroupMemberCommand(_ownerId, _groupId, _targetId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnerRemovesSelf_ReturnsInvalidOperation()
    {
        _store.Add(new StudyGroupMember { UserId = _ownerId, GroupId = _groupId, Role = "owner" });

        var result = await _handler.Handle(new RemoveGroupMemberCommand(_ownerId, _groupId, _ownerId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OPERATION", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TargetNotFound_ReturnsFailure()
    {
        _store.Add(new StudyGroupMember { UserId = _ownerId, GroupId = _groupId, Role = "owner" });

        var result = await _handler.Handle(new RemoveGroupMemberCommand(_ownerId, _groupId, _targetId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owner_RemovesTargetSuccessfully()
    {
        _store.Add(new StudyGroupMember { UserId = _ownerId, GroupId = _groupId, Role = "owner" });
        var target = new StudyGroupMember { UserId = _targetId, GroupId = _groupId, Role = "member" };
        _store.Add(target);

        var result = await _handler.Handle(new RemoveGroupMemberCommand(_ownerId, _groupId, _targetId), default);

        Assert.True(result.IsSuccess);
        _members.Verify(r => r.Remove(target), Times.Once);
    }
}

public class DeleteStudyGroupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly DeleteStudyGroupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public DeleteStudyGroupCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteStudyGroupCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new DeleteStudyGroupCommand(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwner_ReturnsForbidden()
    {
        _groups.Setup(r => r.GetByIdAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, OwnerId = Guid.NewGuid() });

        var result = await _handler.Handle(new DeleteStudyGroupCommand(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owner_DeletesGroup()
    {
        var group = new StudyGroup { StudyGroupId = _groupId, OwnerId = _userId };
        _groups.Setup(r => r.GetByIdAsync(_groupId, default)).ReturnsAsync(group);

        var result = await _handler.Handle(new DeleteStudyGroupCommand(_userId, _groupId), default);

        Assert.True(result.IsSuccess);
        _groups.Verify(r => r.Remove(group), Times.Once);
    }
}

public class ShareCourseWithGroupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly ShareCourseWithGroupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public ShareCourseWithGroupCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ShareCourseWithGroupCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new ShareCourseWithGroupCommand(_userId, _groupId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new ShareCourseWithGroupCommand(_userId, _groupId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyShared_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, CourseName = "Algo" });
        _shared.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(true);

        var result = await _handler.Handle(new ShareCourseWithGroupCommand(_userId, _groupId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_SHARED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidShare_Succeeds()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, CourseName = "Algo" });
        _shared.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(false);
        _shared.Setup(r => r.AddAsync(It.IsAny<StudyGroupSharedCourse>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new ShareCourseWithGroupCommand(_userId, _groupId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Algo", result.Data!.CourseName);
        Assert.Equal(_userId, result.Data.SharedByUserId);
    }
}

public class RemoveSharedCourseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly RemoveSharedCourseCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public RemoveSharedCourseCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RemoveSharedCourseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _shared.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync((StudyGroupSharedCourse?)null);

        var result = await _handler.Handle(new RemoveSharedCourseCommand(_userId, _groupId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotTheSharer_ReturnsForbidden()
    {
        _shared.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new StudyGroupSharedCourse { GroupId = _groupId, CourseId = _courseId, SharedByUserId = Guid.NewGuid() });

        var result = await _handler.Handle(new RemoveSharedCourseCommand(_userId, _groupId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Sharer_RemovesSuccessfully()
    {
        var shared = new StudyGroupSharedCourse { GroupId = _groupId, CourseId = _courseId, SharedByUserId = _userId };
        _shared.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(shared);

        var result = await _handler.Handle(new RemoveSharedCourseCommand(_userId, _groupId, _courseId), default);

        Assert.True(result.IsSuccess);
        _shared.Verify(r => r.Remove(shared), Times.Once);
    }
}

public class SendGroupChatMessageCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IGroupChatMessageRepository> _messages = new();
    private readonly SendGroupChatMessageCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public SendGroupChatMessageCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.GroupChatMessages).Returns(_messages.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SendGroupChatMessageCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(false);

        var result = await _handler.Handle(new SendGroupChatMessageCommand(_userId, _groupId, "hi"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_SendsMessage()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, FullName = "Ada" });
        _messages.Setup(r => r.AddAsync(It.IsAny<GroupChatMessage>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SendGroupChatMessageCommand(_userId, _groupId, "hi"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("hi", result.Data!.Content);
        Assert.Equal("Ada", result.Data.UserName);
    }

    [Fact]
    public async Task Handle_UserRecordMissing_FallsBackToUnknownName()
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);
        _messages.Setup(r => r.AddAsync(It.IsAny<GroupChatMessage>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SendGroupChatMessageCommand(_userId, _groupId, "hi"), default);

        Assert.Equal("Unknown", result.Data!.UserName);
    }
}
