using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// Who gets onto a roster, and how that door is closed again.
///
/// The join code is a bearer credential: anyone holding it can enrol. These cover the two ways an
/// instructor takes it back (rotate, close) and the way they let someone in without it.
/// </summary>
public class ClassroomEnrollmentControlTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IOrganizationRepository> _organizations = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IEntitlementService> _entitlements = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _inviteeId = Guid.NewGuid();

    private Classroom _classroom;

    public ClassroomEnrollmentControlTests()
    {
        _classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            CreatedByUserId = _callerId,
            JoinCode = "OLDCODE1",
            EnrollmentOpen = true
        };

        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);
        _uow.Setup(u => u.Organizations).Returns(_organizations.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default)).ReturnsAsync(() => _classroom);
        _classrooms.Setup(r => r.GetByJoinCodeAsync(It.IsAny<string>(), default)).ReturnsAsync((Classroom?)null);

        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, It.IsAny<Guid>(), default))
            .ReturnsAsync((OrganizationMember?)null);

        _entitlements.Setup(e => e.GetForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Entitlement(PlanCatalog.Team, "user")); // unlimited by default

        _users.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>(), default))
            .ReturnsAsync(new User { UserId = _inviteeId, Email = "sam@school.edu", FullName = "Sam" });
    }

    private void CallerIs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = role });

    private void InviteeNotEnrolled() =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _inviteeId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);

    private void NoPriorEnrollmentRows() =>
        _enrollments.Setup(r => r.FindAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(Array.Empty<ClassroomEnrollment>());

    // ── Rotation ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Rotate_Instructor_IssuesADifferentCode()
    {
        CallerIs(ClassroomRoles.Instructor);
        var handler = new RotateJoinCodeCommandHandler(_uow.Object);

        var result = await handler.Handle(new RotateJoinCodeCommand(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        Assert.NotEqual("OLDCODE1", result.Data);
        Assert.Equal(result.Data, _classroom.JoinCode);
    }

    [Fact]
    public async Task Rotate_Assistant_IsForbidden()
    {
        // An assistant reads the gradebook; handing them the roster's front door is a different thing.
        CallerIs(ClassroomRoles.Assistant);
        var handler = new RotateJoinCodeCommandHandler(_uow.Object);

        var result = await handler.Handle(new RotateJoinCodeCommand(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        Assert.Equal("OLDCODE1", _classroom.JoinCode);
    }

    [Fact]
    public async Task Rotate_ArchivedClassroom_IsRefused()
    {
        CallerIs(ClassroomRoles.Instructor);
        _classroom.ArchivedAt = DateTime.UtcNow;
        var handler = new RotateJoinCodeCommandHandler(_uow.Object);

        var result = await handler.Handle(new RotateJoinCodeCommand(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CLASSROOM_ARCHIVED", result.ErrorCode);
    }

    // ── Closed enrollment ────────────────────────────────────────────────────

    [Fact]
    public async Task Join_WhenEnrollmentIsClosed_IsRefusedEvenWithTheRightCode()
    {
        _classroom.EnrollmentOpen = false;
        _classrooms.Setup(r => r.GetByJoinCodeAsync("OLDCODE1", default)).ReturnsAsync(_classroom);

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new JoinClassroomCommand(_inviteeId, "oldcode1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ENROLLMENT_CLOSED", result.ErrorCode);
        _enrollments.Verify(r => r.AddAsync(It.IsAny<ClassroomEnrollment>(), default), Times.Never);
    }

    [Fact]
    public async Task SetEnrollmentOpen_Instructor_TogglesTheFlag()
    {
        CallerIs(ClassroomRoles.Instructor);
        var handler = new SetEnrollmentOpenCommandHandler(_uow.Object);

        var result = await handler.Handle(new SetEnrollmentOpenCommand(_callerId, _classroomId, false), default);

        Assert.True(result.IsSuccess);
        Assert.False(_classroom.EnrollmentOpen);
    }

    // ── Direct enrollment ────────────────────────────────────────────────────

    [Fact]
    public async Task AddMember_UnknownEmail_IsRejectedRatherThanCreatingAnAccount()
    {
        CallerIs(ClassroomRoles.Instructor);
        _users.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<User, bool>>>(), default))
            .ReturnsAsync((User?)null);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "nobody@school.edu", ClassroomRoles.Student), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task AddMember_NewStudent_IsEnrolledWithoutAJoinCode()
    {
        CallerIs(ClassroomRoles.Instructor);
        InviteeNotEnrolled();
        NoPriorEnrollmentRows();

        ClassroomEnrollment? added = null;
        _enrollments.Setup(r => r.AddAsync(It.IsAny<ClassroomEnrollment>(), default))
            .Callback<ClassroomEnrollment, CancellationToken>((e, _) => added = e);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Student), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(_inviteeId, added!.UserId);
        Assert.Equal(ClassroomRoles.Student, added.Role);
    }

    [Fact]
    public async Task AddMember_PreviouslyRemovedStudent_IsRestoredNotDuplicated()
    {
        // Reviving the original row is what "undo that removal" means — a fresh row would leave their
        // old submissions attached to a dead enrollment and out of the gradebook.
        CallerIs(ClassroomRoles.Instructor);
        InviteeNotEnrolled();

        var removed = new ClassroomEnrollment
        {
            ClassroomEnrollmentId = Guid.NewGuid(),
            ClassroomId = _classroomId,
            UserId = _inviteeId,
            Role = ClassroomRoles.Student,
            EnrolledAt = DateTime.UtcNow.AddMonths(-2),
            RemovedAt = DateTime.UtcNow.AddDays(-1)
        };
        _enrollments.Setup(r => r.FindAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[] { removed });

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Student), default);

        Assert.True(result.IsSuccess);
        Assert.Null(removed.RemovedAt);
        _enrollments.Verify(r => r.AddAsync(It.IsAny<ClassroomEnrollment>(), default), Times.Never);
    }

    [Fact]
    public async Task AddMember_AlreadyEnrolled_ReRolesInsteadOfFailing()
    {
        CallerIs(ClassroomRoles.Instructor);
        var existing = new ClassroomEnrollment
        {
            ClassroomId = _classroomId, UserId = _inviteeId, Role = ClassroomRoles.Student
        };
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _inviteeId, default))
            .ReturnsAsync(existing);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Assistant), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(ClassroomRoles.Assistant, existing.Role);
    }

    [Fact]
    public async Task AddMember_Student_RespectsTheSeatLimit()
    {
        CallerIs(ClassroomRoles.Instructor);
        InviteeNotEnrolled();
        NoPriorEnrollmentRows();

        _entitlements.Setup(e => e.GetForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Entitlement(PlanCatalog.Free, "user")); // 30 seats
        _enrollments.Setup(r => r.CountAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(30);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Student), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CLASSROOM_FULL", result.ErrorCode);
    }

    [Fact]
    public async Task AddMember_Instructor_DoesNotSpendAStudentSeat()
    {
        // Seats are capacity for students; a co-instructor is staff.
        CallerIs(ClassroomRoles.Instructor);
        InviteeNotEnrolled();
        NoPriorEnrollmentRows();

        _entitlements.Setup(e => e.GetForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Entitlement(PlanCatalog.Free, "user"));
        _enrollments.Setup(r => r.CountAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(30);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Instructor), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task AddMember_Assistant_IsForbidden()
    {
        CallerIs(ClassroomRoles.Assistant);

        var handler = new AddClassroomMemberCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new AddClassroomMemberCommand(
            _callerId, _classroomId, "sam@school.edu", ClassroomRoles.Student), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }
}
