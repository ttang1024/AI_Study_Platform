using MediatR;
using StudyPlatform.Application.Common;
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

public record GradebookRowDto(
    Guid UserId,
    string FullName,
    string Email,
    IEnumerable<GradebookCellDto> Cells,
    double? OverallScorePercent,
    long TotalStudyMinutes,
    DateTime? LastActivityAt);

public record GradebookDto(
    Guid ClassroomId,
    IEnumerable<GradebookCourseDto> Courses,
    IEnumerable<GradebookRowDto> Rows);

public record TopicMasteryDto(string Topic, int Attempted, int Correct);

public record StudentProgressDto(
    Guid UserId,
    string FullName,
    string Email,
    IEnumerable<GradebookCellDto> Cells,
    IEnumerable<TopicMasteryDto> WeakestTopics,
    IEnumerable<DailyPointDto> StudyMinutesTrend);

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
                r.OverallScorePercent, r.TotalStudyMinutes, r.LastActivityAt))));
    }

    internal static GradebookCellDto ToCellDto(GradebookCell c) => new(
        c.CourseId, c.QuizSubmissions, c.AverageScorePercent,
        c.ProblemsAttempted, c.ProblemsCorrect, c.StudyMinutes, c.LastActivityAt);
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
            detail.StudyMinutesTrend.Select(d => new DailyPointDto(d.Date, d.Count))));
    }
}
