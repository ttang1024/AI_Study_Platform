using MediatR;
using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// The gradebook repository does no scoping of its own, so these tests exist to prove the handler
/// never reaches it without a passing role check.
/// </summary>
public class GradebookHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IClassroomGradebookRepository> _gradebook = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _otherStudentId = Guid.NewGuid();

    public GradebookHandlerTests()
    {
        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default))
            .ReturnsAsync(new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId });

        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, It.IsAny<Guid>(), default))
            .ReturnsAsync((OrganizationMember?)null);

        _gradebook.Setup(r => r.GetGradebookAsync(_classroomId, default))
            .ReturnsAsync(new ClassroomGradebook(
                _classroomId, Array.Empty<GradebookCourse>(), Array.Empty<GradebookRow>(),
                Array.Empty<GradebookAssignment>()));
    }

    private void CallerEnrolledAs(string role) =>
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = role });

    [Fact]
    public async Task GetGradebook_Student_IsForbiddenAndNeverQueriesTheRepository()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var handler = new GetGradebookQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(new GetGradebookQuery(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        _gradebook.Verify(r => r.GetGradebookAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task GetGradebook_NonMember_IsForbiddenAndNeverQueriesTheRepository()
    {
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync((ClassroomEnrollment?)null);
        var handler = new GetGradebookQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(new GetGradebookQuery(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        _gradebook.Verify(r => r.GetGradebookAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task GetGradebook_Instructor_IsAllowed()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        var handler = new GetGradebookQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(new GetGradebookQuery(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        _gradebook.Verify(r => r.GetGradebookAsync(_classroomId, default), Times.Once);
    }

    [Fact]
    public async Task GetStudentProgress_StudentReadingAnotherStudent_IsForbidden()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        var handler = new GetStudentProgressQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(
            new GetStudentProgressQuery(_callerId, _classroomId, _otherStudentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        _gradebook.Verify(r => r.GetStudentDetailAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task GetStudentProgress_StudentReadingThemselves_IsAllowed()
    {
        CallerEnrolledAs(ClassroomRoles.Student);
        _gradebook.Setup(r => r.GetStudentDetailAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new StudentClassroomDetail(
                _callerId, "Self", "self@example.com",
                Array.Empty<GradebookCell>(), Array.Empty<TopicMastery>(), Array.Empty<DailyCount>(),
                Array.Empty<GradebookAssignment>(), Array.Empty<GradebookSubmissionCell>(), null));

        var handler = new GetStudentProgressQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(
            new GetStudentProgressQuery(_callerId, _classroomId, _callerId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(_callerId, result.Data!.UserId);
    }

    [Fact]
    public async Task GetStudentProgress_AssistantReadingAStudent_IsAllowed()
    {
        CallerEnrolledAs(ClassroomRoles.Assistant);
        _gradebook.Setup(r => r.GetStudentDetailAsync(_classroomId, _otherStudentId, default))
            .ReturnsAsync(new StudentClassroomDetail(
                _otherStudentId, "Student", "student@example.com",
                Array.Empty<GradebookCell>(), Array.Empty<TopicMastery>(), Array.Empty<DailyCount>(),
                Array.Empty<GradebookAssignment>(), Array.Empty<GradebookSubmissionCell>(), null));

        var handler = new GetStudentProgressQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(
            new GetStudentProgressQuery(_callerId, _classroomId, _otherStudentId), default);

        Assert.True(result.IsSuccess);
    }

    // ── CSV export ───────────────────────────────────────────────────────────

    /// <summary>
    /// The exporter delegates to GetGradebookQuery through IMediator, so these drive that seam rather
    /// than the repository — which is exactly the point: the file cannot bypass the query's role check.
    /// </summary>
    private static Mock<IMediator> MediatorReturning(Result<GradebookDto> response)
    {
        var mediator = new Mock<IMediator>();
        mediator.Setup(m => m.Send(It.IsAny<GetGradebookQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(response);
        return mediator;
    }

    [Fact]
    public async Task ExportCsv_WhenTheGradebookIsForbidden_PropagatesTheFailure()
    {
        var mediator = MediatorReturning(Result<GradebookDto>.Failure("Instructor access required.", "FORBIDDEN"));
        var handler = new ExportGradebookCsvQueryHandler(mediator.Object);

        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task ExportCsv_WritesAColumnPerAssignmentAndTheScoresInIt()
    {
        var assignmentId = Guid.NewGuid();
        var book = new GradebookDto(
            _classroomId,
            Array.Empty<GradebookCourseDto>(),
            new[]
            {
                new GradebookRowDto(
                    _otherStudentId, "Ada Lovelace", "ada@example.com",
                    Array.Empty<GradebookCellDto>(), null, 0, null,
                    new[] { new GradebookSubmissionCellDto(assignmentId, "graded", 18, DateTime.UtcNow) },
                    90, 1, 1)
            },
            new[] { new GradebookAssignmentDto(assignmentId, "Essay 1", 20, null) });

        var handler = new ExportGradebookCsvQueryHandler(MediatorReturning(Result<GradebookDto>.Success(book)).Object);

        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains("\"Essay 1 (/20)\"", result.Data);
        Assert.Contains("\"Ada Lovelace\"", result.Data);
        Assert.Contains("\"18\"", result.Data);
    }

    [Fact]
    public async Task ExportCsv_ReportsStatusWhenThereIsNoScoreYet()
    {
        // A blank would merge "handed in, not marked" with "never started" — the two things an
        // instructor is actually scanning the column for.
        var assignmentId = Guid.NewGuid();
        var book = new GradebookDto(
            _classroomId,
            Array.Empty<GradebookCourseDto>(),
            new[]
            {
                new GradebookRowDto(
                    _otherStudentId, "Grace Hopper", "grace@example.com",
                    Array.Empty<GradebookCellDto>(), null, 0, null,
                    new[] { new GradebookSubmissionCellDto(assignmentId, "submitted", null, DateTime.UtcNow) },
                    null, 1, 0)
            },
            new[] { new GradebookAssignmentDto(assignmentId, "Essay 1", 20, null) });

        var handler = new ExportGradebookCsvQueryHandler(MediatorReturning(Result<GradebookDto>.Success(book)).Object);

        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.Contains("\"submitted\"", result.Data);
    }

    [Fact]
    public async Task ExportCsv_NeutralizesSpreadsheetFormulaInjection()
    {
        // A student name is free text, and "=HYPERLINK(...)" in an unquoted cell is a formula that
        // runs when someone opens the export.
        var book = new GradebookDto(
            _classroomId,
            Array.Empty<GradebookCourseDto>(),
            new[]
            {
                new GradebookRowDto(
                    _otherStudentId, "=cmd|'/c calc'!A1", "x@example.com",
                    Array.Empty<GradebookCellDto>(), null, 0, null,
                    Array.Empty<GradebookSubmissionCellDto>(), null, 0, 0)
            },
            Array.Empty<GradebookAssignmentDto>());

        var handler = new ExportGradebookCsvQueryHandler(MediatorReturning(Result<GradebookDto>.Success(book)).Object);

        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.Contains("\"'=cmd", result.Data);
        Assert.DoesNotContain("\"=cmd", result.Data);
    }

    [Fact]
    public async Task GetStudentProgress_StudentNotOnRoster_IsNotFound()
    {
        CallerEnrolledAs(ClassroomRoles.Instructor);
        _gradebook.Setup(r => r.GetStudentDetailAsync(_classroomId, _otherStudentId, default))
            .ReturnsAsync((StudentClassroomDetail?)null);

        var handler = new GetStudentProgressQueryHandler(_uow.Object, _gradebook.Object);

        var result = await handler.Handle(
            new GetStudentProgressQuery(_callerId, _classroomId, _otherStudentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }
}
