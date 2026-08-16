using Moq;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Classrooms;

/// <summary>
/// Covers the field-by-field mapping in GetGradebookQueryHandler / GetStudentProgressQueryHandler /
/// ExportGradebookCsvQueryHandler that <see cref="GradebookHandlerTests"/> leaves untested by using
/// empty repository results for its access-control-focused tests.
/// </summary>
public class GradebookMappingTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IClassroomRepository> _classrooms = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrollments = new();
    private readonly Mock<IOrganizationMemberRepository> _orgMembers = new();
    private readonly Mock<IClassroomGradebookRepository> _gradebook = new();

    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _callerId = Guid.NewGuid();
    private readonly Guid _studentId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();
    private readonly Guid _assignmentId = Guid.NewGuid();

    public GradebookMappingTests()
    {
        _uow.Setup(u => u.Classrooms).Returns(_classrooms.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrollments.Object);
        _uow.Setup(u => u.OrganizationMembers).Returns(_orgMembers.Object);

        _classrooms.Setup(r => r.GetByIdAsync(_classroomId, default))
            .ReturnsAsync(new Classroom { ClassroomId = _classroomId, OrganizationId = _orgId });
        _orgMembers.Setup(r => r.GetMembershipAsync(_orgId, It.IsAny<Guid>(), default))
            .ReturnsAsync((OrganizationMember?)null);
        _enrollments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _callerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _callerId, Role = ClassroomRoles.Instructor });
    }

    [Fact]
    public async Task GetGradebook_MapsEveryFieldThroughToTheDto()
    {
        var cell = new GradebookCell(_courseId, 4, 82.5, 10, 8, 120, DateTime.UtcNow.AddDays(-1));
        var submissionCell = new GradebookSubmissionCell(_assignmentId, "graded", 18, DateTime.UtcNow.AddDays(-2));
        var row = new GradebookRow(
            _studentId, "Ada Lovelace", "ada@example.com",
            new[] { cell }, 82.5, 120, DateTime.UtcNow.AddDays(-1),
            new[] { submissionCell }, 90, 1, 1);
        _gradebook.Setup(r => r.GetGradebookAsync(_classroomId, default))
            .ReturnsAsync(new ClassroomGradebook(
                _classroomId,
                new[] { new GradebookCourse(_courseId, "Algorithms", DateTime.UtcNow) },
                new[] { row },
                new[] { new GradebookAssignment(_assignmentId, "Essay 1", 20, DateTime.UtcNow) }));

        var handler = new GetGradebookQueryHandler(_uow.Object, _gradebook.Object);
        var result = await handler.Handle(new GetGradebookQuery(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        var dto = result.Data!;
        Assert.Equal(_classroomId, dto.ClassroomId);
        var course = Assert.Single(dto.Courses);
        Assert.Equal("Algorithms", course.CourseName);
        var rowDto = Assert.Single(dto.Rows);
        Assert.Equal("Ada Lovelace", rowDto.FullName);
        Assert.Equal(82.5, rowDto.OverallScorePercent);
        var cellDto = Assert.Single(rowDto.Cells);
        Assert.Equal(4, cellDto.QuizSubmissions);
        Assert.Equal(8, cellDto.ProblemsCorrect);
        var assignmentCellDto = Assert.Single(rowDto.Assignments);
        Assert.Equal("graded", assignmentCellDto.Status);
        Assert.Equal(18, assignmentCellDto.PointsAwarded);
        var assignmentDto = Assert.Single(dto.Assignments);
        Assert.Equal("Essay 1", assignmentDto.Title);
        Assert.Equal(20, assignmentDto.PointsPossible);
    }

    [Fact]
    public async Task GetStudentProgress_MapsWeakestTopicsAndTrend()
    {
        var detail = new StudentClassroomDetail(
            _studentId, "Grace Hopper", "grace@example.com",
            new[] { new GradebookCell(_courseId, 2, 60, 5, 3, 30, null) },
            new[] { new TopicMastery("Recursion", 5, 2) },
            new[] { new DailyCount(DateTime.UtcNow.Date, 15) },
            new[] { new GradebookAssignment(_assignmentId, "Essay 1", 20, null) },
            new[] { new GradebookSubmissionCell(_assignmentId, "submitted", null, DateTime.UtcNow) },
            null);
        _gradebook.Setup(r => r.GetStudentDetailAsync(_classroomId, _studentId, default)).ReturnsAsync(detail);

        var handler = new GetStudentProgressQueryHandler(_uow.Object, _gradebook.Object);
        var result = await handler.Handle(new GetStudentProgressQuery(_callerId, _classroomId, _studentId), default);

        Assert.True(result.IsSuccess);
        var dto = result.Data!;
        Assert.Equal("Grace Hopper", dto.FullName);
        var topic = Assert.Single(dto.WeakestTopics);
        Assert.Equal("Recursion", topic.Topic);
        Assert.Equal(2, topic.Correct);
        var point = Assert.Single(dto.StudyMinutesTrend);
        Assert.Equal(15, point.Value);
        Assert.Null(dto.AssignmentScorePercent);
    }

    [Fact]
    public async Task ExportCsv_IncludesPerCourseColumnsAndSummaryFields()
    {
        var mediator = new Mock<MediatR.IMediator>();
        var book = new GradebookDto(
            _classroomId,
            new[] { new GradebookCourseDto(_courseId, "Algorithms", null) },
            new[]
            {
                new GradebookRowDto(
                    _studentId, "Ada Lovelace", "ada@example.com",
                    new[] { new GradebookCellDto(_courseId, 4, 82.5, 8, 10, 120, DateTime.UtcNow) },
                    77.5, 120, new DateTime(2026, 1, 15),
                    Array.Empty<GradebookSubmissionCellDto>(), 90, 1, 1)
            },
            Array.Empty<GradebookAssignmentDto>());
        mediator.Setup(m => m.Send(It.IsAny<GetGradebookQuery>(), default))
            .ReturnsAsync(Result<GradebookDto>.Success(book));

        var handler = new ExportGradebookCsvQueryHandler(mediator.Object);
        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains("\"Algorithms — score %\"", result.Data);
        Assert.Contains("\"82.5\"", result.Data);
        Assert.Contains("\"4\"", result.Data);
        Assert.Contains("\"10/8\"", result.Data);
        Assert.Contains("\"90\"", result.Data);
        Assert.Contains("\"77.5\"", result.Data);
        Assert.Contains("\"2026-01-15\"", result.Data);
    }

    [Fact]
    public async Task ExportCsv_MissingCourseCellAndAssignmentSubmission_RendersBlanksAndDefaults()
    {
        var mediator = new Mock<MediatR.IMediator>();
        var book = new GradebookDto(
            _classroomId,
            new[] { new GradebookCourseDto(_courseId, "Algorithms", null) },
            new[]
            {
                new GradebookRowDto(
                    _studentId, "New Student", "new@example.com",
                    Array.Empty<GradebookCellDto>(), null, 0, null,
                    Array.Empty<GradebookSubmissionCellDto>(), null, 0, 0)
            },
            new[] { new GradebookAssignmentDto(_assignmentId, "Essay 1", 20, null) });
        mediator.Setup(m => m.Send(It.IsAny<GetGradebookQuery>(), default))
            .ReturnsAsync(Result<GradebookDto>.Success(book));

        var handler = new ExportGradebookCsvQueryHandler(mediator.Object);
        var result = await handler.Handle(new ExportGradebookCsvQuery(_callerId, _classroomId), default);

        Assert.Contains("\"0/0\"", result.Data);
        Assert.Contains("\"not_started\"", result.Data);
    }
}
