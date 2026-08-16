using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// Covers the classroom CRUD/roster handlers not already exercised by ClassroomEnrollmentControlTests
/// and AssignmentHandlerTests: listing, detail, creation, course assignment, and archiving.
/// </summary>
public class ClassroomFeatureTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationRepository> _organizations = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IClassroomCourseRepository> _classroomCourses = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IEntitlementService> _entitlements = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();

    public ClassroomFeatureTests()
    {
        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.Organizations).Returns(_organizations.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);
        _uow.Setup(u => u.ClassroomCourses).Returns(_classroomCourses.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default))
            .ReturnsAsync(new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId });
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, It.IsAny<Guid>(), default))
            .ReturnsAsync((OrganizationMember?)null);
        _entitlements.Setup(e => e.GetForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Entitlement(PlanCatalog.Team, "user"));
    }

    private void CallerEnrolledAs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = role });

    // ── GetMyClassroomsQuery ────────────────────────────────────────────────

    [Fact]
    public async Task GetMyClassrooms_ReturnsDtoWithResolvedOrgNameAndStudentCount()
    {
        var classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            Name = "Physics",
            Enrollments = new List<ClassroomEnrollment>
            {
                new() { UserId = _callerId, Role = ClassroomRoles.Instructor },
                new() { UserId = Guid.NewGuid(), Role = ClassroomRoles.Student },
                new() { UserId = Guid.NewGuid(), Role = ClassroomRoles.Student, RemovedAt = DateTime.UtcNow },
            }
        };
        _classrooms.Setup(r => r.GetByUserAsync(_callerId, default)).ReturnsAsync(new[] { classroom });
        _organizations.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Organization, bool>>>(), default))
            .ReturnsAsync(new[] { new Organization { OrganizationId = _orgId, Name = "Acme U" } });

        var handler = new GetMyClassroomsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetMyClassroomsQuery(_callerId), default);

        var dto = result.Data!.Single();
        Assert.Equal("Acme U", dto.OrganizationName);
        Assert.Equal(1, dto.StudentCount);
        Assert.Equal(ClassroomRoles.Instructor, dto.MyRole);
    }

    [Fact]
    public async Task GetMyClassrooms_JoinCodeIsWithheldFromAStudent()
    {
        var classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            Name = "Physics",
            JoinCode = "SECRET1",
            Enrollments = new List<ClassroomEnrollment> { new() { UserId = _callerId, Role = ClassroomRoles.Student } }
        };
        _classrooms.Setup(r => r.GetByUserAsync(_callerId, default)).ReturnsAsync(new[] { classroom });
        _organizations.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Organization, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Organization>());

        var handler = new GetMyClassroomsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetMyClassroomsQuery(_callerId), default);

        Assert.Null(result.Data!.Single().JoinCode);
    }

    // ── GetClassroomDetailQuery ──────────────────────────────────────────────

    [Fact]
    public async Task GetDetail_NonMember_IsForbidden()
    {
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);

        var handler = new GetClassroomDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomDetailQuery(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task GetDetail_Student_DoesNotSeeClassmatesInTheRoster()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var classmate = Guid.NewGuid();
        var instructor = Guid.NewGuid();
        var classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            Enrollments = new List<ClassroomEnrollment>
            {
                new() { UserId = _callerId, Role = ClassroomRoles.Student, User = new User { UserId = _callerId, FullName = "Me", Email = "me@x.com" } },
                new() { UserId = classmate, Role = ClassroomRoles.Student, User = new User { UserId = classmate, FullName = "Classmate", Email = "c@x.com" } },
                new() { UserId = instructor, Role = ClassroomRoles.Instructor, User = new User { UserId = instructor, FullName = "Teacher", Email = "t@x.com" } },
            },
            Courses = new List<ClassroomCourse>()
        };
        _classrooms.Setup(r => r.GetWithRosterAsync(_classroomId, default)).ReturnsAsync(classroom);

        var handler = new GetClassroomDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomDetailQuery(_callerId, _classroomId), default);

        var names = result.Data!.Roster.Select(r => r.FullName).ToList();
        Assert.Contains("Me", names);
        Assert.Contains("Teacher", names);
        Assert.DoesNotContain("Classmate", names);
    }

    [Fact]
    public async Task GetDetail_Instructor_SeesTheWholeRoster()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var student = Guid.NewGuid();
        var classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            Enrollments = new List<ClassroomEnrollment>
            {
                new() { UserId = _callerId, Role = ClassroomRoles.Instructor, User = new User { UserId = _callerId, FullName = "Me", Email = "me@x.com" } },
                new() { UserId = student, Role = ClassroomRoles.Student, User = new User { UserId = student, FullName = "Student", Email = "s@x.com" } },
            },
            Courses = new List<ClassroomCourse>()
        };
        _classrooms.Setup(r => r.GetWithRosterAsync(_classroomId, default)).ReturnsAsync(classroom);

        var handler = new GetClassroomDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomDetailQuery(_callerId, _classroomId), default);

        Assert.Equal(2, result.Data!.Roster.Count());
    }

    // ── CreateClassroomCommand ───────────────────────────────────────────────

    [Fact]
    public async Task Create_NonTeachingOrgRole_IsForbidden()
    {
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = OrganizationRoles.Member });

        var handler = new CreateClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new CreateClassroomCommand(_callerId, _orgId, "New Class", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Create_AtQuota_IsRefused()
    {
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = OrganizationRoles.Instructor });
        _entitlements.Setup(e => e.GetForUserAsync(_callerId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Entitlement(PlanCatalog.Free, "user"));
        _classrooms.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Classroom, bool>>>(), default)).ReturnsAsync(1);

        var handler = new CreateClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new CreateClassroomCommand(_callerId, _orgId, "New Class", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CLASSROOM_LIMIT_REACHED", result.ErrorCode);
    }

    [Fact]
    public async Task Create_Success_EnrollsCreatorAsInstructor()
    {
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = OrganizationRoles.Owner });
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default))
            .ReturnsAsync(new Organization { OrganizationId = _orgId, Name = "Acme U" });
        _classrooms.Setup(r => r.GetByJoinCodeAsync(It.IsAny<string>(), default)).ReturnsAsync((Classroom?)null);

        ClassroomEnrollment? added = null;
        _enrollments.Setup(r => r.AddAsync(It.IsAny<ClassroomEnrollment>(), default))
            .Callback<ClassroomEnrollment, CancellationToken>((e, _) => added = e);

        var handler = new CreateClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new CreateClassroomCommand(_callerId, _orgId, "  New Class  ", null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Class", result.Data!.Name);
        Assert.Equal(ClassroomRoles.Instructor, added!.Role);
        Assert.Equal(_callerId, added.UserId);
    }

    [Fact]
    public async Task Create_MissingOrganization_ReturnsFailure()
    {
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = OrganizationRoles.Owner });
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default)).ReturnsAsync((Organization?)null);

        var handler = new CreateClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new CreateClassroomCommand(_callerId, _orgId, "New Class", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    // ── JoinClassroomCommand ─────────────────────────────────────────────────

    [Fact]
    public async Task Join_UnknownCode_IsNotFound()
    {
        _classrooms.Setup(r => r.GetByJoinCodeAsync("BADCODE1", default)).ReturnsAsync((Classroom?)null);

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new JoinClassroomCommand(_callerId, "badcode1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Join_ArchivedClassroom_IsRefused()
    {
        var classroom = new Classroom
        {
            ClassroomId = _classroomId, OrganizationId = _orgId, JoinCode = "CODE1234",
            EnrollmentOpen = true, ArchivedAt = DateTime.UtcNow
        };
        _classrooms.Setup(r => r.GetByJoinCodeAsync("CODE1234", default)).ReturnsAsync(classroom);

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new JoinClassroomCommand(_callerId, "code1234"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CLASSROOM_ARCHIVED", result.ErrorCode);
    }

    [Fact]
    public async Task Join_AlreadyEnrolled_IsRefused()
    {
        var classroom = new Classroom
        {
            ClassroomId = _classroomId, OrganizationId = _orgId, JoinCode = "CODE1234", EnrollmentOpen = true
        };
        _classrooms.Setup(r => r.GetByJoinCodeAsync("CODE1234", default)).ReturnsAsync(classroom);
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = ClassroomRoles.Student });

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new JoinClassroomCommand(_callerId, "code1234"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_ENROLLED", result.ErrorCode);
    }

    [Fact]
    public async Task Join_Success_GrantsImpliedOrgMembershipWhenAbsent()
    {
        var creatorId = Guid.NewGuid();
        var classroom = new Classroom
        {
            ClassroomId = _classroomId, OrganizationId = _orgId, JoinCode = "CODE1234",
            EnrollmentOpen = true, CreatedByUserId = creatorId
        };
        _classrooms.Setup(r => r.GetByJoinCodeAsync("CODE1234", default)).ReturnsAsync(classroom);
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default)).ReturnsAsync(new Organization { OrganizationId = _orgId, Name = "Acme U" });

        OrganizationMember? addedMembership = null;
        _orgMembers.Setup(r => r.AddAsync(It.IsAny<OrganizationMember>(), default))
            .Callback<OrganizationMember, CancellationToken>((m, _) => addedMembership = m);

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        var result = await handler.Handle(new JoinClassroomCommand(_callerId, "code1234"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(OrganizationRoles.Member, addedMembership!.Role);
        Assert.Equal(_callerId, addedMembership.UserId);
    }

    [Fact]
    public async Task Join_ExistingOrgMembership_DoesNotDuplicateIt()
    {
        var classroom = new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId, JoinCode = "CODE1234", EnrollmentOpen = true };
        _classrooms.Setup(r => r.GetByJoinCodeAsync("CODE1234", default)).ReturnsAsync(classroom);
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default)).ReturnsAsync((ClassroomEnrollment?)null);
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _callerId, default))
            .ReturnsAsync(new OrganizationMember { OrganizationId = _orgId, UserId = _callerId, Role = OrganizationRoles.Member });
        _organizations.Setup(r => r.GetByIdAsync(_orgId, default)).ReturnsAsync(new Organization { OrganizationId = _orgId, Name = "Acme U" });

        var handler = new JoinClassroomCommandHandler(_uow.Object, _entitlements.Object);
        await handler.Handle(new JoinClassroomCommand(_callerId, "code1234"), default);

        _orgMembers.Verify(r => r.AddAsync(It.IsAny<OrganizationMember>(), default), Times.Never);
    }

    // ── SetEnrollmentRoleCommand ─────────────────────────────────────────────

    [Fact]
    public async Task SetRole_TargetNotEnrolled_IsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var target = Guid.NewGuid();
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, target, default)).ReturnsAsync((ClassroomEnrollment?)null);

        var handler = new SetEnrollmentRoleCommandHandler(_uow.Object);
        var result = await handler.Handle(new SetEnrollmentRoleCommand(_callerId, _classroomId, target, ClassroomRoles.Assistant), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task SetRole_DemotingTheLastInstructor_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var target = _callerId;
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, target, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = target, Role = ClassroomRoles.Instructor });
        _enrollments.Setup(r => r.CountAsync(It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default)).ReturnsAsync(1);

        var handler = new SetEnrollmentRoleCommandHandler(_uow.Object);
        var result = await handler.Handle(new SetEnrollmentRoleCommand(_callerId, _classroomId, target, ClassroomRoles.Assistant), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("LAST_INSTRUCTOR", result.ErrorCode);
    }

    [Fact]
    public async Task SetRole_WithASecondInstructor_Succeeds()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var target = Guid.NewGuid();
        var enrollment = new ClassroomEnrollment { ClassroomId = _classroomId, UserId = target, Role = ClassroomRoles.Instructor };
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, target, default)).ReturnsAsync(enrollment);
        _enrollments.Setup(r => r.CountAsync(It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default)).ReturnsAsync(2);

        var handler = new SetEnrollmentRoleCommandHandler(_uow.Object);
        var result = await handler.Handle(new SetEnrollmentRoleCommand(_callerId, _classroomId, target, ClassroomRoles.Assistant), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(ClassroomRoles.Assistant, enrollment.Role);
    }

    // ── RemoveEnrollmentCommand ──────────────────────────────────────────────

    [Fact]
    public async Task Remove_SelfRemoval_DoesNotRequireManagerRights()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = ClassroomRoles.Student });

        var handler = new RemoveEnrollmentCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveEnrollmentCommand(_callerId, _classroomId, _callerId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Remove_AnotherStudent_RequiresManagerRights()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var target = Guid.NewGuid();

        var handler = new RemoveEnrollmentCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveEnrollmentCommand(_callerId, _classroomId, target), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Remove_LastInstructor_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _enrollments.Setup(r => r.CountAsync(It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default)).ReturnsAsync(1);

        var handler = new RemoveEnrollmentCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveEnrollmentCommand(_callerId, _classroomId, _callerId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("LAST_INSTRUCTOR", result.ErrorCode);
    }

    [Fact]
    public async Task Remove_SoftRemovesRatherThanDeleting()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var target = Guid.NewGuid();
        var enrollment = new ClassroomEnrollment { ClassroomId = _classroomId, UserId = target, Role = ClassroomRoles.Student };
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, target, default)).ReturnsAsync(enrollment);

        var handler = new RemoveEnrollmentCommandHandler(_uow.Object);
        var result = await handler.Handle(new RemoveEnrollmentCommand(_callerId, _classroomId, target), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(enrollment.RemovedAt);
        _enrollments.Verify(r => r.Update(enrollment), Times.Once);
    }

    // ── AssignCourseToClassroomCommand / UnassignCourseCommand ──────────────

    [Fact]
    public async Task AssignCourse_NotOwnedByCaller_IsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _courses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync((Course?)null);

        var handler = new AssignCourseToClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new AssignCourseToClassroomCommand(_callerId, _classroomId, Guid.NewGuid(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task AssignCourse_NewAssignment_IsCreated()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var courseId = Guid.NewGuid();
        _courses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(new Course { CourseId = courseId, UserId = _callerId, CourseName = "Algo" });
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync((ClassroomCourse?)null);

        var handler = new AssignCourseToClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new AssignCourseToClassroomCommand(_callerId, _classroomId, courseId, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Algo", result.Data!.CourseName);
        _classroomCourses.Verify(r => r.AddAsync(It.IsAny<ClassroomCourse>(), default), Times.Once);
    }

    [Fact]
    public async Task AssignCourse_AlreadyAssigned_UpdatesTheDueDateInstead()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var courseId = Guid.NewGuid();
        var newDue = DateTime.UtcNow.AddDays(7);
        _courses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(new Course { CourseId = courseId, UserId = _callerId, CourseName = "Algo" });
        var existing = new ClassroomCourse { ClassroomCourseId = Guid.NewGuid(), ClassroomId = _classroomId, CourseId = courseId };
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync(existing);

        var handler = new AssignCourseToClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new AssignCourseToClassroomCommand(_callerId, _classroomId, courseId, newDue), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(newDue, existing.DueAt);
        _classroomCourses.Verify(r => r.AddAsync(It.IsAny<ClassroomCourse>(), default), Times.Never);
    }

    [Fact]
    public async Task UnassignCourse_NotFound_ReturnsFailure()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync((ClassroomCourse?)null);

        var handler = new UnassignCourseCommandHandler(_uow.Object);
        var result = await handler.Handle(new UnassignCourseCommand(_callerId, _classroomId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task UnassignCourse_Success_RemovesTheAssignment()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var assignment = new ClassroomCourse { ClassroomCourseId = Guid.NewGuid(), ClassroomId = _classroomId };
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync(assignment);

        var handler = new UnassignCourseCommandHandler(_uow.Object);
        var result = await handler.Handle(new UnassignCourseCommand(_callerId, _classroomId, assignment.ClassroomCourseId), default);

        Assert.True(result.IsSuccess);
        _classroomCourses.Verify(r => r.Remove(assignment), Times.Once);
    }

    // ── ArchiveClassroomCommand ───────────────────────────────────────────────

    [Fact]
    public async Task Archive_Assistant_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);

        var handler = new ArchiveClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new ArchiveClassroomCommand(_callerId, _classroomId, true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Archive_Instructor_SetsArchivedAt()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var handler = new ArchiveClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new ArchiveClassroomCommand(_callerId, _classroomId, true), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Unarchive_Instructor_ClearsArchivedAt()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var classroom = new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId, ArchivedAt = DateTime.UtcNow };
        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default)).ReturnsAsync(classroom);

        var handler = new ArchiveClassroomCommandHandler(_uow.Object);
        var result = await handler.Handle(new ArchiveClassroomCommand(_callerId, _classroomId, false), default);

        Assert.True(result.IsSuccess);
        Assert.Null(classroom.ArchivedAt);
    }
}
