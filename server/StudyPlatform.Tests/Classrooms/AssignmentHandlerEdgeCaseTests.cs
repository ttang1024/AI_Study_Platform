using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// Covers branches of AssignmentFeature.cs not exercised by <see cref="AssignmentHandlerTests"/>:
/// the staff list view, not-found paths on Update/Delete/Grade, and the update-without-republishing
/// and grade-with-unknown-student fallbacks.
/// </summary>
public class AssignmentHandlerEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IClassroomAssignmentRepository> _assignments = new();
    private readonly Mock<IClassroomSubmissionRepository> _submissions = new();
    private readonly Mock<IClassroomCourseRepository> _classroomCourses = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPushNotificationService> _push = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _assignmentId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _otherStudentId = Guid.NewGuid();

    private readonly Classroom _classroom;
    private readonly ClassroomAssignment _assignment;

    public AssignmentHandlerEdgeCaseTests()
    {
        _classroom = new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId };
        _assignment = new ClassroomAssignment
        {
            ClassroomAssignmentId = _assignmentId,
            ClassroomId = _classroomId,
            Title = "Essay 1",
            PointsPossible = 100,
            PublishedAt = DateTime.UtcNow.AddDays(-1),
            AllowLateSubmissions = true
        };

        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);
        _uow.Setup(u => u.ClassroomAssignments).Returns(_assignments.Object);
        _uow.Setup(u => u.ClassroomSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.ClassroomCourses).Returns(_classroomCourses.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default)).ReturnsAsync(_classroom);
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, It.IsAny<Guid>(), default))
            .ReturnsAsync((OrganizationMember?)null);
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync(_assignment);
        _assignments.Setup(r => r.GetByClassroomAsync(_classroomId, default))
            .ReturnsAsync(new[] { _assignment });
        _submissions.Setup(r => r.GetForStudentAcrossAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<Guid>(), default))
            .ReturnsAsync(Array.Empty<ClassroomSubmission>());
        _submissions.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomSubmission, bool>>>(), default))
            .ReturnsAsync(Array.Empty<ClassroomSubmission>());
        _submissions.Setup(r => r.CountAsync(
                It.IsAny<Expression<Func<ClassroomSubmission, bool>>>(), default))
            .ReturnsAsync(0);
        _courses.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Course>());
    }

    private void CallerEnrolledAs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = role });

    private static ClassroomSubmission Submission(
        Guid assignmentId, Guid studentId, string text, DateTime? submittedAt, DateTime? gradedAt = null) => new()
    {
        ClassroomSubmissionId = Guid.NewGuid(),
        ClassroomAssignmentId = assignmentId,
        StudentUserId = studentId,
        Text = text,
        SubmittedAt = submittedAt,
        GradedAt = gradedAt,
        PointsAwarded = gradedAt != null ? 80 : null
    };

    // ── List: staff view ────────────────────────────────────────────────────

    [Fact]
    public async Task List_Staff_SeesSubmittedAndGradedCounts()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _enrollments.Setup(r => r.CountAsync(It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(5);
        _submissions.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomSubmission, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                Submission(_assignmentId, _otherStudentId, "a", DateTime.UtcNow, DateTime.UtcNow),
                Submission(_assignmentId, Guid.NewGuid(), "b", DateTime.UtcNow),
            });

        var handler = new GetClassroomAssignmentsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomAssignmentsQuery(_callerId, _classroomId), default);

        var dto = result.Data!.Single();
        Assert.Equal(2, dto.SubmittedCount);
        Assert.Equal(1, dto.GradedCount);
        Assert.Equal(5, dto.StudentCount);
        Assert.Null(dto.MyStatus);
    }

    [Fact]
    public async Task List_NoAssignments_ReturnsEmptyWithoutFurtherLookups()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignments.Setup(r => r.GetByClassroomAsync(_classroomId, default))
            .ReturnsAsync(Array.Empty<ClassroomAssignment>());

        var handler = new GetClassroomAssignmentsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomAssignmentsQuery(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
        _courses.Verify(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Course, bool>>>(), default), Times.Never);
    }

    // ── Detail: classroom disappears between the access check and the roster read ──

    [Fact]
    public async Task Detail_Staff_ClassroomMissingWhenLoadingRoster_ReturnsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _classrooms.Setup(r => r.GetWithRosterAsync(_classroomId, default)).ReturnsAsync((Classroom?)null);

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Detail_AssignmentDoesNotExist_ReturnsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync((ClassroomAssignment?)null);

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    // ── Update ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_Assistant_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "New title", null, null, 100, null, true, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Update_AssignmentNotFound_ReturnsFailure()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync((ClassroomAssignment?)null);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "New title", null, null, 100, null, true, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Update_CourseNotAssignedToClassroom_ReturnsFailure()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var courseId = Guid.NewGuid();
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync((ClassroomCourse?)null);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "New title", null, courseId, 100, null, true, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_ASSIGNED", result.ErrorCode);
    }

    [Fact]
    public async Task Update_EditingLiveAssignment_DoesNotReNotify()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        // Already published before the edit.
        _assignment.PublishedAt = DateTime.UtcNow.AddDays(-3);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "Fixed typo", null, null, 100, null, true, true), default);

        Assert.True(result.IsSuccess);
        _push.Verify(p => p.SendToUserAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Update_DraftJustPublished_NotifiesStudents()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _assignment.PublishedAt = null;
        _enrollments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[] { new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _otherStudentId, Role = ClassroomRoles.Student, RemovedAt = null } });
        _enrollments.Setup(r => r.CountAsync(It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(1);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "Now live", null, null, 100, null, true, true), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(_assignment.PublishedAt);
        _push.Verify(p => p.SendToUserAsync(
            _otherStudentId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
    }

    // ── Delete ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_Assistant_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);

        var handler = new DeleteClassroomAssignmentCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new DeleteClassroomAssignmentCommand(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Delete_AssignmentNotFound_ReturnsFailure()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync((ClassroomAssignment?)null);

        var handler = new DeleteClassroomAssignmentCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new DeleteClassroomAssignmentCommand(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Delete_NoSubmissions_Succeeds()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var handler = new DeleteClassroomAssignmentCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new DeleteClassroomAssignmentCommand(_callerId, _classroomId, _assignmentId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _assignments.Verify(r => r.Remove(_assignment), Times.Once);
    }

    // ── Save submission: not-found and access paths ────────────────────────

    [Fact]
    public async Task Save_NotEnrolled_ReturnsFailure()
    {
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "text", false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Save_UnpublishedAssignment_ReturnsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignment.PublishedAt = null;

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "text", false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Save_WrongClassroomAssignment_ReturnsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var foreign = new ClassroomAssignment { ClassroomAssignmentId = _assignmentId, ClassroomId = Guid.NewGuid(), PublishedAt = DateTime.UtcNow };
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync(foreign);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "text", false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    // ── Grade: not-found and unknown-student paths ──────────────────────────

    [Fact]
    public async Task Grade_AssignmentNotFound_ReturnsFailure()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync((ClassroomAssignment?)null);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 50, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Grade_StudentRecordMissing_StillGradesWithEmptyName()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var submission = Submission(_assignmentId, _otherStudentId, "answer", DateTime.UtcNow.AddDays(-1));
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(submission);
        _users.Setup(r => r.GetByIdAsync(_otherStudentId, default)).ReturnsAsync((User?)null);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 75, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(string.Empty, result.Data!.StudentName);
    }

    [Fact]
    public async Task Grade_ClassroomMissingWhenNotifying_StillSucceeds()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var submission = Submission(_assignmentId, _otherStudentId, "answer", DateTime.UtcNow.AddDays(-1));
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(submission);
        _users.Setup(r => r.GetByIdAsync(_otherStudentId, default))
            .ReturnsAsync(new User { UserId = _otherStudentId, FullName = "Ana" });
        // RequireWritableAsync alone looks the classroom up twice (once inside RequireMemberAsync,
        // once for its own archived-check); the post-grade notify lookup is a third, separate call.
        // Only that third call should observe the classroom having vanished.
        _classrooms.SetupSequence(r => r.GetByIdAsync(_classroomId, default))
            .ReturnsAsync(_classroom)
            .ReturnsAsync(_classroom)
            .ReturnsAsync((Classroom?)null);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 90, "great"), default);

        Assert.True(result.IsSuccess);
        _push.Verify(p => p.SendToUserAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }
}
