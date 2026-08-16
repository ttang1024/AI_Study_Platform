using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

public class OrganizationFeatureTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IOrganizationRepository> _organizations = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IUserRepository> _users = new();

    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _inviteeId = Guid.NewGuid();

    public OrganizationFeatureTests()
    {
        _uow.Setup(u => u.Organizations).Returns(_organizations.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);
    }

    private void CallerHasRole(string role) =>
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = role });

    // ── GetMyOrganizationsQuery ───────────────────────────────────────────────

    [Fact]
    public async Task GetMyOrganizations_ReturnsMemberAndClassroomCounts()
    {
        var org = new Organization
        {
            OrganizationId = _orgId,
            Name = "Acme U",
            Slug = "acme-u",
            Members = new List<OrganizationMember>
            {
                new() { UserId = _callerId, Role = OrganizationRoles.Owner },
                new() { UserId = Guid.NewGuid(), Role = OrganizationRoles.Member },
            },
            Classrooms = new List<Classroom> { new() }
        };
        _organizations.Setup(r => r.GetByUserAsync(_callerId, default)).ReturnsAsync(new[] { org });

        var handler = new GetMyOrganizationsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetMyOrganizationsQuery(_callerId), default);

        var dto = result.Data!.Single();
        Assert.Equal(2, dto.MemberCount);
        Assert.Equal(1, dto.ClassroomCount);
        Assert.Equal(OrganizationRoles.Owner, dto.MyRole);
    }

    // ── GetOrganizationDetailQuery ────────────────────────────────────────────

    [Fact]
    public async Task GetDetail_NonMember_IsNotFound()
    {
        var handler = new GetOrganizationDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetOrganizationDetailQuery(_callerId, _orgId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task GetDetail_PlainMember_OnlySeesTeachingStaff()
    {
        CallerHasRole(OrganizationRoles.Member);
        var instructor = Guid.NewGuid();
        var otherMember = Guid.NewGuid();
        var org = new Organization
        {
            OrganizationId = _orgId,
            Name = "Acme U",
            Slug = "acme-u",
            Members = new List<OrganizationMember>
            {
                new() { UserId = _callerId, Role = OrganizationRoles.Member, User = new User { UserId = _callerId, FullName = "Me", Email = "me@x.com" } },
                new() { UserId = instructor, Role = OrganizationRoles.Instructor, User = new User { UserId = instructor, FullName = "Teacher", Email = "t@x.com" } },
                new() { UserId = otherMember, Role = OrganizationRoles.Member, User = new User { UserId = otherMember, FullName = "Other", Email = "o@x.com" } },
            }
        };
        _organizations.Setup(r => r.GetWithMembersAsync(_orgId, default)).ReturnsAsync(org);

        var handler = new GetOrganizationDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetOrganizationDetailQuery(_callerId, _orgId), default);

        var names = result.Data!.Members.Select(m => m.FullName).ToList();
        Assert.Contains("Teacher", names);
        Assert.DoesNotContain("Me", names);
        Assert.DoesNotContain("Other", names);
    }

    [Fact]
    public async Task GetDetail_Admin_SeesEveryMember()
    {
        CallerHasRole(OrganizationRoles.Admin);
        var org = new Organization
        {
            OrganizationId = _orgId,
            Name = "Acme U",
            Slug = "acme-u",
            Members = new List<OrganizationMember>
            {
                new() { UserId = _callerId, Role = OrganizationRoles.Admin, User = new User { UserId = _callerId, FullName = "Me", Email = "me@x.com" } },
                new() { UserId = Guid.NewGuid(), Role = OrganizationRoles.Member, User = new User { UserId = Guid.NewGuid(), FullName = "Other", Email = "o@x.com" } },
            }
        };
        _organizations.Setup(r => r.GetWithMembersAsync(_orgId, default)).ReturnsAsync(org);

        var handler = new GetOrganizationDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetOrganizationDetailQuery(_callerId, _orgId), default);

        Assert.Equal(2, result.Data!.Members.Count());
    }

    // ── CreateOrganizationCommand ─────────────────────────────────────────────

    [Fact]
    public async Task Create_MakesTheCreatorOwner()
    {
        _organizations.Setup(r => r.GetBySlugAsync(It.IsAny<string>(), default)).ReturnsAsync((Organization?)null);

        OrganizationMember? added = null;
        _orgMembers.Setup(r => r.AddAsync(It.IsAny<OrganizationMember>(), default))
            .Callback<OrganizationMember, CancellationToken>((m, _) => added = m);

        var handler = new CreateOrganizationCommandHandler(_uow.Object);
        var result = await handler.Handle(new CreateOrganizationCommand(_callerId, "Acme University"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(OrganizationRoles.Owner, added!.Role);
        Assert.Equal(OrganizationRoles.Owner, result.Data!.MyRole);
        Assert.Matches("^[a-z0-9-]+$", result.Data.Slug);
    }

    // ── InviteOrganizationMemberCommand ───────────────────────────────────────

    [Fact]
    public async Task Invite_NonAdministrator_IsForbidden()
    {
        CallerHasRole(OrganizationRoles.Member);

        var handler = new InviteOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new InviteOrganizationMemberCommand(_callerId, _orgId, "new@school.edu", OrganizationRoles.Member), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Invite_AdminGrantingOwnerRole_IsForbidden()
    {
        CallerHasRole(OrganizationRoles.Admin);

        var handler = new InviteOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new InviteOrganizationMemberCommand(_callerId, _orgId, "new@school.edu", OrganizationRoles.Owner), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Invite_OwnerGrantingOwnerRole_IsAllowed()
    {
        CallerHasRole(OrganizationRoles.Owner);
        _users.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>(), default))
            .ReturnsAsync(new User { UserId = _inviteeId, Email = "new@school.edu", FullName = "New" });
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _inviteeId, default)).ReturnsAsync((OrganizationMember?)null);

        var handler = new InviteOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new InviteOrganizationMemberCommand(_callerId, _orgId, "new@school.edu", OrganizationRoles.Owner), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Invite_UnknownEmail_IsRejected()
    {
        CallerHasRole(OrganizationRoles.Owner);
        _users.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>(), default))
            .ReturnsAsync((User?)null);

        var handler = new InviteOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new InviteOrganizationMemberCommand(_callerId, _orgId, "nobody@school.edu", OrganizationRoles.Member), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Invite_AlreadyMember_ReRolesInsteadOfDuplicating()
    {
        CallerHasRole(OrganizationRoles.Owner);
        _users.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>(), default))
            .ReturnsAsync(new User { UserId = _inviteeId, Email = "existing@school.edu", FullName = "Existing" });
        var existing = new OrganizationMember { OrganizationId = _orgId, UserId = _inviteeId, Role = OrganizationRoles.Member };
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _inviteeId, default)).ReturnsAsync(existing);

        var handler = new InviteOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new InviteOrganizationMemberCommand(_callerId, _orgId, "existing@school.edu", OrganizationRoles.Instructor), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(OrganizationRoles.Instructor, existing.Role);
        _orgMembers.Verify(r => r.AddAsync(It.IsAny<OrganizationMember>(), default), Times.Never);
    }

    // ── RemoveOrganizationMemberCommand ───────────────────────────────────────

    [Fact]
    public async Task Remove_NonAdministrator_IsForbidden()
    {
        CallerHasRole(OrganizationRoles.Instructor);

        var handler = new RemoveOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveOrganizationMemberCommand(_callerId, _orgId, _inviteeId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Remove_TheOwner_IsRefused()
    {
        CallerHasRole(OrganizationRoles.Admin);
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default))
            .ReturnsAsync(new Organization { OrganizationId = _orgId, OwnerId = _inviteeId });

        var handler = new RemoveOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveOrganizationMemberCommand(_callerId, _orgId, _inviteeId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Remove_UnknownMember_IsNotFound()
    {
        CallerHasRole(OrganizationRoles.Admin);
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default))
            .ReturnsAsync(new Organization { OrganizationId = _orgId, OwnerId = _callerId });
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _inviteeId, default)).ReturnsAsync((OrganizationMember?)null);

        var handler = new RemoveOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveOrganizationMemberCommand(_callerId, _orgId, _inviteeId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Remove_Success_RemovesTheMembership()
    {
        CallerHasRole(OrganizationRoles.Admin);
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default))
            .ReturnsAsync(new Organization { OrganizationId = _orgId, OwnerId = _callerId });
        var membership = new OrganizationMember { OrganizationId = _orgId, UserId = _inviteeId, Role = OrganizationRoles.Member };
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _inviteeId, default)).ReturnsAsync(membership);

        var handler = new RemoveOrganizationMemberCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveOrganizationMemberCommand(_callerId, _orgId, _inviteeId), default);

        Assert.True(result.IsSuccess);
        _orgMembers.Verify(r => r.Remove(membership), Times.Once);
    }
}
