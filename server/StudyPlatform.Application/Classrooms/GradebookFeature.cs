using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record GradebookCourseDto(Guid CourseId, string CourseName, DateTime? DueAt);

public record GradebookCellDto(
    Guid CourseId,
    int QuizSubmissions,
    double? AverageScorePercent,
    int ProblemsAttempted,
    int ProblemsCorrect,
    long StudyMinutes,
    DateTime? LastActivityAt);

public record GradebookAssignmentDto(
    Guid ClassroomAssignmentId,
    string Title,
    double PointsPossible,
    DateTime? DueAt);

public record GradebookSubmissionCellDto(
    Guid ClassroomAssignmentId,
    string Status,
    double? PointsAwarded,
    DateTime? SubmittedAt);

public record GradebookRowDto(
    Guid UserId,
    string FullName,
    string Email,
    IEnumerable<GradebookCellDto> Cells,
    double? OverallScorePercent,
    long TotalStudyMinutes,
    DateTime? LastActivityAt,
    IEnumerable<GradebookSubmissionCellDto> Assignments,
    double? AssignmentScorePercent,
    int AssignmentsSubmitted,
    int AssignmentsGraded);

public record GradebookDto(
    Guid ClassroomId,
    IEnumerable<GradebookCourseDto> Courses,
    IEnumerable<GradebookRowDto> Rows,
    IEnumerable<GradebookAssignmentDto> Assignments);

public record TopicMasteryDto(string Topic, int Attempted, int Correct);

public record StudentProgressDto(
    Guid UserId,
    string FullName,
    string Email,
    IEnumerable<GradebookCellDto> Cells,
    IEnumerable<TopicMasteryDto> WeakestTopics,
    IEnumerable<DailyPointDto> StudyMinutesTrend,
    IEnumerable<GradebookAssignmentDto> Assignments,
    IEnumerable<GradebookSubmissionCellDto> Submissions,
    double? AssignmentScorePercent);

public record DailyPointDto(DateTime Date, int Value);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetGradebookQuery(Guid UserId, Guid ClassroomId) : IRequest<Result<GradebookDto>>;

public class GetGradebookQueryHandler : IRequestHandler<GetGradebookQuery, Result<GradebookDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClassroomGradebookRepository _gradebook;

    public GetGradebookQueryHandler(IUnitOfWork unitOfWork, IClassroomGradebookRepository gradebook)
    {
        _unitOfWork = unitOfWork;
        _gradebook = gradebook;
    }

    public async Task<Result<GradebookDto>> Handle(GetGradebookQuery request, CancellationToken cancellationToken)
    {
        // The gradebook repository does no scoping of its own — this check is what keeps it honest.
        var access = await ClassroomAccess.RequireGraderAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
        if (!access.IsSuccess)
            return Result<GradebookDto>.Failure(access.Message, access.ErrorCode);

        var book = await _gradebook.GetGradebookAsync(request.ClassroomId, cancellationToken);

        return Result<GradebookDto>.Success(new GradebookDto(
            book.ClassroomId,
            book.Courses.Select(c => new GradebookCourseDto(c.CourseId, c.CourseName, c.DueAt)),
            book.Rows.Select(r => new GradebookRowDto(
                r.UserId, r.FullName, r.Email,
                r.Cells.Select(ToCellDto),
                r.OverallScorePercent, r.TotalStudyMinutes, r.LastActivityAt,
                r.Assignments.Select(ToSubmissionCellDto),
                r.AssignmentScorePercent, r.AssignmentsSubmitted, r.AssignmentsGraded)),
            book.Assignments.Select(ToAssignmentDto)));
    }

    internal static GradebookCellDto ToCellDto(GradebookCell c) => new(
        c.CourseId, c.QuizSubmissions, c.AverageScorePercent,
        c.ProblemsAttempted, c.ProblemsCorrect, c.StudyMinutes, c.LastActivityAt);

    internal static GradebookAssignmentDto ToAssignmentDto(GradebookAssignment a) => new(
        a.ClassroomAssignmentId, a.Title, a.PointsPossible, a.DueAt);

    internal static GradebookSubmissionCellDto ToSubmissionCellDto(GradebookSubmissionCell c) => new(
        c.ClassroomAssignmentId, c.Status, c.PointsAwarded, c.SubmittedAt);
}

/// <summary>
/// The gradebook as a CSV, for the spreadsheet an instructor actually reports marks in.
///
/// Built on top of <see cref="GetGradebookQuery"/> rather than a second query of its own, so the file
/// can never disagree with the grid it was exported from — including its authorization, which is the
/// part that must not be re-derived here.
/// </summary>
public record ExportGradebookCsvQuery(Guid UserId, Guid ClassroomId) : IRequest<Result<string>>;

public class ExportGradebookCsvQueryHandler : IRequestHandler<ExportGradebookCsvQuery, Result<string>>
{
    private readonly IMediator _mediator;
    public ExportGradebookCsvQueryHandler(IMediator mediator) { _mediator = mediator; }

    public async Task<Result<string>> Handle(ExportGradebookCsvQuery request, CancellationToken cancellationToken)
    {
        var book = await _mediator.Send(new GetGradebookQuery(request.UserId, request.ClassroomId), cancellationToken);
        if (!book.IsSuccess)
            return Result<string>.Failure(book.Message, book.ErrorCode);

        var data = book.Data!;
        var courses = data.Courses.ToList();
        var assignments = data.Assignments.ToList();

        var header = new List<string> { "Student", "Email" };
        foreach (var c in courses)
        {
            header.Add($"{c.CourseName} — score %");
            header.Add($"{c.CourseName} — quizzes");
            header.Add($"{c.CourseName} — problems correct");
            header.Add($"{c.CourseName} — minutes");
        }
        foreach (var a in assignments)
            header.Add($"{a.Title} (/{a.PointsPossible:0.##})");

        header.Add("Assignment score %");
        header.Add("Overall quiz score %");
        header.Add("Total minutes");
        header.Add("Last activity");

        var sb = new System.Text.StringBuilder();
        sb.AppendLine(string.Join(",", header.Select(Csv)));

        foreach (var row in data.Rows)
        {
            var cells = row.Cells.ToList();
            var submissions = row.Assignments.ToList();
            var fields = new List<string> { row.FullName, row.Email };

            foreach (var c in courses)
            {
                var cell = cells.FirstOrDefault(x => x.CourseId == c.CourseId);
                fields.Add(cell?.AverageScorePercent?.ToString("0.#") ?? string.Empty);
                fields.Add((cell?.QuizSubmissions ?? 0).ToString());
                fields.Add($"{cell?.ProblemsCorrect ?? 0}/{cell?.ProblemsAttempted ?? 0}");
                fields.Add((cell?.StudyMinutes ?? 0).ToString());
            }

            foreach (var a in assignments)
            {
                var s = submissions.FirstOrDefault(x => x.ClassroomAssignmentId == a.ClassroomAssignmentId);

                // An ungraded hand-in reports its status rather than a blank, so a reader can tell
                // "waiting on me to mark it" from "this student never did it".
                fields.Add(s?.PointsAwarded?.ToString("0.##") ?? s?.Status ?? SubmissionStatus.NotStarted);
            }

            fields.Add(row.AssignmentScorePercent?.ToString("0.#") ?? string.Empty);
            fields.Add(row.OverallScorePercent?.ToString("0.#") ?? string.Empty);
            fields.Add(row.TotalStudyMinutes.ToString());
            fields.Add(row.LastActivityAt?.ToString("yyyy-MM-dd") ?? string.Empty);

            sb.AppendLine(string.Join(",", fields.Select(Csv)));
        }

        return Result<string>.Success(sb.ToString());
    }

    /// <summary>
    /// Quotes a field for CSV. Everything is quoted rather than only what needs it: student names and
    /// assignment titles are free text, and a leading = or + in an unquoted cell is a formula waiting
    /// to run in whatever spreadsheet opens this.
    /// </summary>
    private static string Csv(string? value)
    {
        var text = value ?? string.Empty;

        // Neutralize spreadsheet formula injection without altering what the cell reads as.
        if (text.Length > 0 && (text[0] is '=' or '+' or '-' or '@'))
            text = "'" + text;

        return $"\"{text.Replace("\"", "\"\"")}\"";
    }
}

public record GetStudentProgressQuery(Guid UserId, Guid ClassroomId, Guid StudentUserId)
    : IRequest<Result<StudentProgressDto>>;

public class GetStudentProgressQueryHandler
    : IRequestHandler<GetStudentProgressQuery, Result<StudentProgressDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClassroomGradebookRepository _gradebook;

    public GetStudentProgressQueryHandler(IUnitOfWork unitOfWork, IClassroomGradebookRepository gradebook)
    {
        _unitOfWork = unitOfWork;
        _gradebook = gradebook;
    }

    public async Task<Result<StudentProgressDto>> Handle(
        GetStudentProgressQuery request, CancellationToken cancellationToken)
    {
        // A student may open their own progress page; reading anyone else's needs grader rights.
        var isSelf = request.StudentUserId == request.UserId;
        var access = isSelf
            ? await ClassroomAccess.RequireMemberAsync(_unitOfWork, request.ClassroomId, request.UserId, cancellationToken)
            : await ClassroomAccess.RequireGraderAsync(_unitOfWork, request.ClassroomId, request.UserId, cancellationToken);

        if (!access.IsSuccess)
            return Result<StudentProgressDto>.Failure(access.Message, access.ErrorCode);

        var detail = await _gradebook.GetStudentDetailAsync(
            request.ClassroomId, request.StudentUserId, cancellationToken);

        if (detail == null)
            return Result<StudentProgressDto>.Failure("That student is not on this roster.", "NOT_FOUND");

        return Result<StudentProgressDto>.Success(new StudentProgressDto(
            detail.UserId, detail.FullName, detail.Email,
            detail.Cells.Select(GetGradebookQueryHandler.ToCellDto),
            detail.WeakestTopics.Select(t => new TopicMasteryDto(t.Topic, t.Attempted, t.Correct)),
            detail.StudyMinutesTrend.Select(d => new DailyPointDto(d.Date, d.Count)),
            detail.Assignments.Select(GetGradebookQueryHandler.ToAssignmentDto),
            detail.Submissions.Select(GetGradebookQueryHandler.ToSubmissionCellDto),
            detail.AssignmentScorePercent));
    }
}
