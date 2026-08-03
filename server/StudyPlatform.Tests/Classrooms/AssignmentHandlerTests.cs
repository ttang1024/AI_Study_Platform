using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// The assignment feature is where a student's own words get stored, so these tests are about who is
/// allowed to read and write them. The rules being pinned down:
///
///   • a student reads their own submission and never a classmate's
///   • an unsubmitted draft is private even from teaching staff
///   • only staff can score, and only work that was actually handed in
///   • an archived classroom is read-only for everybody
///
/// Each of these has a natural implementation that gets it wrong, which is why they are tested rather
/// than assumed.
/// </summary>
public class AssignmentHandlerTests
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

    public AssignmentHandlerTests()
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
        _courses.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Course>());
    }

    private void CallerEnrolledAs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = role });

    private void RosterIs(params (Guid UserId, string Name, string Role)[] members)
    {
        var classroom = new Classroom
        {
            ClassroomId = _classroomId,
            OrganizationId = _orgId,
            Enrollments = members.Select(m => new ClassroomEnrollment
            {
                ClassroomId = _classroomId,
                UserId = m.UserId,
                Role = m.Role,
                User = new User { UserId = m.UserId, FullName = m.Name, Email = $"{m.Name}@example.com" }
            }).ToList()
        };
        _classrooms.Setup(r => r.GetWithRosterAsync(_classroomId, default)).ReturnsAsync(classroom);
    }

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

    // ── Reading ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Detail_Student_NeverReceivesAnotherStudentsSubmission()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _callerId, default))
            .ReturnsAsync(Submission(_assignmentId, _callerId, "my answer", DateTime.UtcNow));

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("my answer", result.Data!.MySubmission!.Text);
        // Null rather than an empty list: the roster is not enumerated for a student at all.
        Assert.Null(result.Data.Submissions);
        _assignments.Verify(r => r.GetWithSubmissionsAsync(It.IsAny<Guid>(), default), Times.Never);
        _classrooms.Verify(r => r.GetWithRosterAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Detail_Student_CannotOpenAnUnpublishedDraftAssignment()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignment.PublishedAt = null;

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        // NOT_FOUND, not FORBIDDEN — a draft's existence is itself not disclosed.
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Detail_Instructor_SeesEveryStudentIncludingThoseWhoNeverStarted()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        RosterIs(
            (_otherStudentId, "Ana", ClassroomRoles.Student),
            (Guid.NewGuid(), "Bo", ClassroomRoles.Student),
            (_callerId, "Teacher", ClassroomRoles.Instructor));

        _assignments.Setup(r => r.GetWithSubmissionsAsync(_assignmentId, default))
            .ReturnsAsync(new ClassroomAssignment
            {
                ClassroomAssignmentId = _assignmentId,
                ClassroomId = _classroomId,
                Submissions = new List<ClassroomSubmission>
                {
                    Submission(_assignmentId, _otherStudentId, "Ana's answer", DateTime.UtcNow)
                }
            });

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        Assert.True(result.IsSuccess);
        var rows = result.Data!.Submissions!.ToList();

        // Two students, not three — the instructor is not a row in their own gradebook.
        Assert.Equal(2, rows.Count);
        Assert.Equal("Ana's answer", rows.Single(r => r.StudentUserId == _otherStudentId).Text);
        Assert.Equal(SubmissionStatus.NotStarted, rows.Single(r => r.StudentName == "Bo").Status);
    }

    [Fact]
    public async Task Detail_Instructor_SeesThatADraftExistsButNotItsText()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        RosterIs((_otherStudentId, "Ana", ClassroomRoles.Student));

        _assignments.Setup(r => r.GetWithSubmissionsAsync(_assignmentId, default))
            .ReturnsAsync(new ClassroomAssignment
            {
                ClassroomAssignmentId = _assignmentId,
                ClassroomId = _classroomId,
                Submissions = new List<ClassroomSubmission>
                {
                    Submission(_assignmentId, _otherStudentId, "half-written private thoughts", submittedAt: null)
                }
            });

        var handler = new GetClassroomAssignmentDetailQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetClassroomAssignmentDetailQuery(_callerId, _classroomId, _assignmentId), default);

        var row = result.Data!.Submissions!.Single();
        Assert.Equal(SubmissionStatus.Draft, row.Status);
        Assert.Equal(string.Empty, row.Text);
    }

    [Fact]
    public async Task List_Student_DoesNotSeeDrafts()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var published = _assignment;
        var draft = new ClassroomAssignment
        {
            ClassroomAssignmentId = Guid.NewGuid(),
            ClassroomId = _classroomId,
            Title = "Not ready",
            PublishedAt = null
        };
        _assignments.Setup(r => r.GetByClassroomAsync(_classroomId, default))
            .ReturnsAsync(new[] { published, draft });

        var handler = new GetClassroomAssignmentsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomAssignmentsQuery(_callerId, _classroomId), default);

        var listed = result.Data!.ToList();
        Assert.Single(listed);
        Assert.Equal("Essay 1", listed[0].Title);
        // Counts are staff-only: a student is not told how many classmates have handed in.
        Assert.Null(listed[0].SubmittedCount);
    }

    [Fact]
    public async Task List_NonMember_IsForbidden()
    {
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);

        var handler = new GetClassroomAssignmentsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomAssignmentsQuery(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        _assignments.Verify(r => r.GetByClassroomAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task List_StudentSeesOwnReleasedGradeButNotAnUnreleasedOne()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _submissions.Setup(r => r.GetForStudentAcrossAsync(
                It.IsAny<IEnumerable<Guid>>(), _callerId, default))
            .ReturnsAsync(new[] { Submission(_assignmentId, _callerId, "answer", DateTime.UtcNow) });

        var handler = new GetClassroomAssignmentsQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetClassroomAssignmentsQuery(_callerId, _classroomId), default);

        var dto = result.Data!.Single();
        Assert.Equal(SubmissionStatus.Submitted, dto.MyStatus);
        Assert.Null(dto.MyPointsAwarded);
    }

    // ── Writing a submission ────────────────────────────────────────────────

    [Fact]
    public async Task Save_TeachingStaff_CannotSubmitToTheirOwnAssignment()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "text", Submit: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Save_WritesTheCallersOwnRow_NotAnyoneElses()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _callerId, default))
            .ReturnsAsync((ClassroomSubmission?)null);

        ClassroomSubmission? added = null;
        _submissions.Setup(r => r.AddAsync(It.IsAny<ClassroomSubmission>(), default))
            .Callback<ClassroomSubmission, CancellationToken>((s, _) => added = s);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "my work", Submit: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(_callerId, added!.StudentUserId);
        Assert.NotNull(added.SubmittedAt);
    }

    [Fact]
    public async Task Save_DraftIsNotAHandIn()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _callerId, default))
            .ReturnsAsync((ClassroomSubmission?)null);

        ClassroomSubmission? added = null;
        _submissions.Setup(r => r.AddAsync(It.IsAny<ClassroomSubmission>(), default))
            .Callback<ClassroomSubmission, CancellationToken>((s, _) => added = s);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "wip", Submit: false), default);

        Assert.Null(added!.SubmittedAt);
        Assert.Equal(SubmissionStatus.Draft, SubmissionStatus.Resolve(added, _assignment.DueAt));
    }

    [Fact]
    public async Task Save_PastDeadlineWithLateSubmissionsOff_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignment.DueAt = DateTime.UtcNow.AddDays(-1);
        _assignment.AllowLateSubmissions = false;

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "late work", Submit: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PAST_DUE", result.ErrorCode);
    }

    [Fact]
    public async Task Save_PastDeadlineWithLateSubmissionsOn_IsAcceptedAndFlaggedLate()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _assignment.DueAt = DateTime.UtcNow.AddDays(-1);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _callerId, default))
            .ReturnsAsync((ClassroomSubmission?)null);

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "late work", Submit: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(SubmissionStatus.Late, result.Data!.Status);
    }

    [Fact]
    public async Task Save_AfterGrading_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _callerId, default))
            .ReturnsAsync(Submission(_assignmentId, _callerId, "graded work", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow));

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "rewrite", Submit: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_GRADED", result.ErrorCode);
    }

    [Fact]
    public async Task Save_ArchivedClassroom_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _classroom.ArchivedAt = DateTime.UtcNow;

        var handler = new SaveClassroomSubmissionCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new SaveClassroomSubmissionCommand(_callerId, _classroomId, _assignmentId, "text", Submit: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CLASSROOM_ARCHIVED", result.ErrorCode);
    }

    // ── Grading ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Grade_Student_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Student);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 90, "nice"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        _submissions.Verify(r => r.GetForStudentAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Grade_StudentCannotEvenGradeThemselves()
    {
        CallerEnrolledAs(ClassroomRoles.Student);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _callerId, 100, "A+"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Grade_Assistant_IsAllowed()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);
        var submission = Submission(_assignmentId, _otherStudentId, "answer", DateTime.UtcNow.AddDays(-1));
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(submission);
        _users.Setup(r => r.GetByIdAsync(_otherStudentId, default))
            .ReturnsAsync(new User { UserId = _otherStudentId, FullName = "Ana" });

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 90, "well argued"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(90, submission.PointsAwarded);
        Assert.Equal(_callerId, submission.GradedByUserId);
        Assert.NotNull(submission.GradedAt);
    }

    [Fact]
    public async Task Grade_ADraftIsNotGradable()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(Submission(_assignmentId, _otherStudentId, "wip", submittedAt: null));

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 50, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Grade_ScoreAboveTheMaximum_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, 101, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("SCORE_TOO_HIGH", result.ErrorCode);
    }

    [Fact]
    public async Task Grade_ClearingTheScoreReturnsTheWorkForEditing()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var submission = Submission(
            _assignmentId, _otherStudentId, "answer", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(submission);
        _users.Setup(r => r.GetByIdAsync(_otherStudentId, default))
            .ReturnsAsync(new User { UserId = _otherStudentId, FullName = "Ana" });

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, null, "please resubmit"), default);

        Assert.True(result.IsSuccess);
        Assert.Null(submission.GradedAt);
        Assert.Null(submission.PointsAwarded);
    }

    // ── Authoring ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_Assistant_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "New work", null, null, 100, null, true, Publish: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        _assignments.Verify(r => r.AddAsync(It.IsAny<ClassroomAssignment>(), default), Times.Never);
    }

    [Fact]
    public async Task Create_LinkingACourseNotAssignedToTheClassroom_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _classroomCourses.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<Expression<Func<ClassroomCourse, bool>>>(), default))
            .ReturnsAsync((ClassroomCourse?)null);

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "New work", null, Guid.NewGuid(), 100, null, true, Publish: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_ASSIGNED", result.ErrorCode);
    }

    [Fact]
    public async Task Create_UnpublishedByDefault_StaysADraft()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        ClassroomAssignment? added = null;
        _assignments.Setup(r => r.AddAsync(It.IsAny<ClassroomAssignment>(), default))
            .Callback<ClassroomAssignment, CancellationToken>((a, _) => added = a);

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "Draft work", null, null, 50, null, true, Publish: false), default);

        Assert.True(result.IsSuccess);
        Assert.Null(added!.PublishedAt);
        Assert.False(result.Data!.IsPublished);
    }

    // ── Notifications ───────────────────────────────────────────────────────

    [Fact]
    public async Task Create_Published_NotifiesEveryActiveStudent()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var studentA = Guid.NewGuid();
        var studentB = Guid.NewGuid();
        _enrollments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = studentA, Role = ClassroomRoles.Student },
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = studentB, Role = ClassroomRoles.Student }
            });

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "Essay 1", null, null, 100, null, true, Publish: true), default);

        Assert.True(result.IsSuccess);
        _push.Verify(p => p.SendToUserAsync(studentA, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
        _push.Verify(p => p.SendToUserAsync(studentB, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
    }

    [Fact]
    public async Task Create_AsADraft_NotifiesNobody()
    {
        // A draft is the instructor's private workspace — the class must not hear about it.
        CallerEnrolledAs(ClassroomRoles.Instructor);

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "Not ready", null, null, 100, null, true, Publish: false), default);

        Assert.True(result.IsSuccess);
        _push.Verify(p => p.SendToUserAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Create_WhenPushThrows_StillPublishesTheAssignment()
    {
        // "Degrade, don't fail": an undeliverable notification must not cost the instructor their work.
        CallerEnrolledAs(ClassroomRoles.Instructor);

        _enrollments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new ClassroomEnrollment
                {
                    ClassroomId = _classroomId, UserId = Guid.NewGuid(), Role = ClassroomRoles.Student
                }
            });

        _push.Setup(p => p.SendToUserAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new HttpRequestException("push endpoint unreachable"));

        var handler = new CreateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new CreateClassroomAssignmentCommand(
            _callerId, _classroomId, "Essay 1", null, null, 100, null, true, Publish: true), default);

        Assert.True(result.IsSuccess);
        _assignments.Verify(r => r.AddAsync(It.IsAny<ClassroomAssignment>(), default), Times.Once);
    }

    [Fact]
    public async Task Grade_ClearingAScore_NotifiesNobody()
    {
        // Handing work back is not an interruption worth sending; the student sees it when they open it.
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var submission = Submission(
            _assignmentId, _otherStudentId, "answer", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow);
        _submissions.Setup(r => r.GetForStudentAsync(_assignmentId, _otherStudentId, default))
            .ReturnsAsync(submission);
        _users.Setup(r => r.GetByIdAsync(_otherStudentId, default))
            .ReturnsAsync(new User { UserId = _otherStudentId, FullName = "Ana" });

        var handler = new GradeClassroomSubmissionCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new GradeClassroomSubmissionCommand(
            _callerId, _classroomId, _assignmentId, _otherStudentId, null, "please resubmit"), default);

        Assert.True(result.IsSuccess);
        _push.Verify(p => p.SendToUserAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Delete_OnceSomethingHasBeenHandedIn_IsRefused()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _submissions.Setup(r => r.CountAsync(
                It.IsAny<Expression<Func<ClassroomSubmission, bool>>>(), default))
            .ReturnsAsync(1);

        var handler = new DeleteClassroomAssignmentCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new DeleteClassroomAssignmentCommand(_callerId, _classroomId, _assignmentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("HAS_SUBMISSIONS", result.ErrorCode);
        _assignments.Verify(r => r.Remove(It.IsAny<ClassroomAssignment>()), Times.Never);
    }

    [Fact]
    public async Task Update_CannotRetargetAnAssignmentFromAnotherClassroom()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var foreign = new ClassroomAssignment
        {
            ClassroomAssignmentId = _assignmentId,
            ClassroomId = Guid.NewGuid(),
            Title = "Someone else's"
        };
        _assignments.Setup(r => r.GetByIdAsync(_assignmentId, default)).ReturnsAsync(foreign);

        var handler = new UpdateClassroomAssignmentCommandHandler(_uow.Object, _push.Object);
        var result = await handler.Handle(new UpdateClassroomAssignmentCommand(
            _callerId, _classroomId, _assignmentId, "Hijacked", null, null, 100, null, true, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }
}
