using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// The deadlines query is the one definition of "outstanding classwork" that the notification digest
/// and the calendar feed both read, so what it chooses to include is a product decision worth pinning.
/// </summary>
public class ClassroomDeadlinesQueryTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IClassroomAssignmentRepository> _assignments = new();
    private readonly Mock<IClassroomSubmissionRepository> _submissions = new();
    private readonly Mock<IClassroomCourseRepository> _classroomCourses = new();
    private readonly Mock<ICourseRepository> _courses = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _classroomId = Guid.NewGuid();

    public ClassroomDeadlinesQueryTests()
    {
        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.ClassroomAssignments).Returns(_assignments.Object);
        _uow.Setup(u => u.ClassroomSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.ClassroomCourses).Returns(_classroomCourses.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);

        // Default: enrolled as a student in one live classroom, no course deadlines.
        _enrollments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new ClassroomEnrollment
                {
                    ClassroomId = _classroomId, UserId = _userId, Role = ClassroomRoles.Student
                }
            });

        _classrooms.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<Classroom, bool>>>(), default))
            .ReturnsAsync(new[] { new Classroom { ClassroomId = _classroomId, Name = "Physics 101" } });

        _classroomCourses.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync(Array.Empty<ClassroomCourse>());

        _submissions.Setup(r => r.GetForStudentAcrossAsync(
                It.IsAny<IEnumerable<Guid>>(), _userId, default))
            .ReturnsAsync(Array.Empty<ClassroomSubmission>());
    }

    private void AssignmentsAre(params ClassroomAssignment[] assignments) =>
        _assignments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomAssignment, bool>>>(), default))
            .ReturnsAsync(assignments);

    private ClassroomAssignment Due(DateTime dueAt, string title = "Essay 1") => new()
    {
        ClassroomAssignmentId = Guid.NewGuid(),
        ClassroomId = _classroomId,
        Title = title,
        DueAt = dueAt,
        PublishedAt = DateTime.UtcNow.AddDays(-5)
    };

    private Task<StudyPlatform.Application.Common.Result<IReadOnlyList<ClassroomDeadlineDto>>> Run()
        => new GetClassroomDeadlinesQueryHandler(_uow.Object)
            .Handle(new GetClassroomDeadlinesQuery(_userId), default);

    [Fact]
    public async Task UpcomingAssignment_IsListed()
    {
        AssignmentsAre(Due(DateTime.UtcNow.AddDays(3)));

        var result = await Run();

        var item = Assert.Single(result.Data!);
        Assert.Equal("Essay 1", item.Title);
        Assert.Equal("Physics 101", item.ClassroomName);
        Assert.False(item.IsOverdue);
    }

    [Fact]
    public async Task OverdueAssignment_StaysOnTheListAndIsFlagged()
    {
        // Missed work is more worth showing than work that is still ahead, so it does not drop off.
        AssignmentsAre(Due(DateTime.UtcNow.AddDays(-2)));

        var result = await Run();

        var item = Assert.Single(result.Data!);
        Assert.True(item.IsOverdue);
    }

    [Fact]
    public async Task AlreadyHandedIn_IsExcluded()
    {
        // Waiting on a grade is not something to chase the student about.
        var assignment = Due(DateTime.UtcNow.AddDays(3));
        AssignmentsAre(assignment);

        _submissions.Setup(r => r.GetForStudentAcrossAsync(
                It.IsAny<IEnumerable<Guid>>(), _userId, default))
            .ReturnsAsync(new[]
            {
                new ClassroomSubmission
                {
                    ClassroomAssignmentId = assignment.ClassroomAssignmentId,
                    StudentUserId = _userId,
                    SubmittedAt = DateTime.UtcNow.AddDays(-1)
                }
            });

        var result = await Run();

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task UnsubmittedDraft_IsStillListed()
    {
        // A draft is not a hand-in — the student still owes this one.
        var assignment = Due(DateTime.UtcNow.AddDays(3));
        AssignmentsAre(assignment);

        _submissions.Setup(r => r.GetForStudentAcrossAsync(
                It.IsAny<IEnumerable<Guid>>(), _userId, default))
            .ReturnsAsync(new[]
            {
                new ClassroomSubmission
                {
                    ClassroomAssignmentId = assignment.ClassroomAssignmentId,
                    StudentUserId = _userId,
                    Text = "half an answer",
                    SubmittedAt = null
                }
            });

        var result = await Run();

        var item = Assert.Single(result.Data!);
        Assert.Equal(SubmissionStatus.Draft, item.Status);
    }

    [Fact]
    public async Task ArchivedClassroom_ContributesNothing()
    {
        // The classroom repository filters archived rows out, so nothing resolves to a live classroom.
        _classrooms.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<Classroom, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Classroom>());

        var result = await Run();

        Assert.Empty(result.Data!);
        _assignments.Verify(r => r.FindAsNoTrackingAsync(
            It.IsAny<Expression<Func<ClassroomAssignment, bool>>>(), default), Times.Never);
    }

    [Fact]
    public async Task StaffEnrollmentOnly_ContributesNothing()
    {
        // An instructor has no work due to themselves.
        _enrollments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(Array.Empty<ClassroomEnrollment>());

        var result = await Run();

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Results_AreOrderedBySoonestFirst()
    {
        AssignmentsAre(
            Due(DateTime.UtcNow.AddDays(5), "Later"),
            Due(DateTime.UtcNow.AddDays(1), "Sooner"));

        var result = await Run();

        Assert.Equal(new[] { "Sooner", "Later" }, result.Data!.Select(d => d.Title));
    }
}
