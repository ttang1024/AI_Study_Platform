using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// Classrooms are the only feature where one user reads another user's rows, so the authorization
/// gate is the thing worth testing hardest. Everything below is a denial case except where noted.
/// </summary>
public class ClassroomAccessTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public ClassroomAccessTests()
    {
        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default))
            .ReturnsAsync(new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId });
    }

    private void EnrolledAs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _userId, default))
            .ReturnsAsync(new ClassroomEnrollment
            {
                ClassroomId = _classroomId,
                UserId = _userId,
                Role = role
            });

    private void NotEnrolled() =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _userId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);

    private void OrgRole(string? role) =>
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, _userId, default))
            .ReturnsAsync(role == null
                ? null
                : new OrganizationMember { OrganizationId = _orgId, UserId = _userId, Role = role });

    [Fact]
    public async Task RequireMember_UnknownClassroom_IsNotFound()
    {
        var unknown = Guid.NewGuid();
        _classrooms.Setup(r => r.GetByIdAsync(unknown, default)).ReturnsAsync((Classroom?)null);

        var result = await ClassroomAccess.RequireMemberAsync(_uow.Object, unknown, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task RequireMember_StrangerWithNoOrgRole_IsForbidden()
    {
        NotEnrolled();
        OrgRole(null);

        var result = await ClassroomAccess.RequireMemberAsync(_uow.Object, _classroomId, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task RequireMember_PlainOrgMemberNotEnrolled_IsForbidden()
    {
        // Belonging to the institution must not by itself grant access to every classroom in it.
        NotEnrolled();
        OrgRole(OrganizationRoles.Member);

        var result = await ClassroomAccess.RequireMemberAsync(_uow.Object, _classroomId, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task RequireMember_OrgInstructorNotEnrolled_IsForbidden()
    {
        // An instructor elsewhere in the org is still a stranger to *this* classroom.
        NotEnrolled();
        OrgRole(OrganizationRoles.Instructor);

        var result = await ClassroomAccess.RequireMemberAsync(_uow.Object, _classroomId, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task RequireMember_OrgAdminNotEnrolled_GetsInstructorRole()
    {
        // Deliberate escape hatch: without it a classroom whose only instructor left is unrecoverable.
        NotEnrolled();
        OrgRole(OrganizationRoles.Admin);

        var result = await ClassroomAccess.RequireMemberAsync(_uow.Object, _classroomId, _userId, default);

        Assert.True(result.IsSuccess);
        Assert.Equal(ClassroomRoles.Instructor, result.Data);
    }

    [Fact]
    public async Task RequireGrader_Student_IsForbidden()
    {
        EnrolledAs(ClassroomRoles.Student);

        var result = await ClassroomAccess.RequireGraderAsync(_uow.Object, _classroomId, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Theory]
    [InlineData(ClassroomRoles.Instructor)]
    [InlineData(ClassroomRoles.Assistant)]
    public async Task RequireGrader_TeachingStaff_IsAllowed(string role)
    {
        EnrolledAs(role);

        var result = await ClassroomAccess.RequireGraderAsync(_uow.Object, _classroomId, _userId, default);

        Assert.True(result.IsSuccess);
        Assert.Equal(role, result.Data);
    }

    [Fact]
    public async Task RequireManager_Assistant_IsForbidden()
    {
        // An assistant may read the gradebook but must not be able to change the roster.
        EnrolledAs(ClassroomRoles.Assistant);

        var result = await ClassroomAccess.RequireManagerAsync(_uow.Object, _classroomId, _userId, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task RequireManager_Instructor_IsAllowed()
    {
        EnrolledAs(ClassroomRoles.Instructor);

        var result = await ClassroomAccess.RequireManagerAsync(_uow.Object, _classroomId, _userId, default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task RequireOrganizationRole_NonMember_IsNotFound()
    {
        // A non-member gets NOT_FOUND rather than FORBIDDEN so the API does not confirm that an
        // organization with this id exists.
        OrgRole(null);

        var result = await ClassroomAccess.RequireOrganizationRoleAsync(
            _uow.Object, _orgId, _userId, _ => true, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task RequireOrganizationRole_InstructorCannotAdminister()
    {
        OrgRole(OrganizationRoles.Instructor);

        var result = await ClassroomAccess.RequireOrganizationRoleAsync(
            _uow.Object, _orgId, _userId, OrganizationRoles.CanAdminister, default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public void GenerateCode_ExcludesAmbiguousCharacters()
    {
        // Join codes get read aloud in a room, so 0/O and 1/I must never appear.
        for (var i = 0; i < 200; i++)
        {
            var code = ClassroomAccess.GenerateCode();
            Assert.Equal(8, code.Length);
            Assert.DoesNotContain(code, c => c is '0' or 'O' or '1' or 'I');
        }
    }

    [Fact]
    public void GenerateSlug_IsUrlSafeAndSuffixed()
    {
        var slug = ClassroomAccess.GenerateSlug("St. Mary's  College / Physics!");

        Assert.Matches("^[a-z0-9-]+$", slug);
        Assert.DoesNotContain("--", slug);
        Assert.DoesNotMatch("^-|-$", slug);
    }
}
