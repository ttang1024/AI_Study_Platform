using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Planner;

public record CreateExamPlanCommand(Guid UserId, string Title, DateTime ExamDate, Guid? CourseId, int DailyMinutes)
    : IRequest<Result<ExamPlanDto>>;

public record DeleteExamPlanCommand(Guid PlanId, Guid UserId) : IRequest<Result<bool>>;

public record GetExamPlansQuery(Guid UserId) : IRequest<Result<IReadOnlyList<ExamPlanDto>>>;

public class CreateExamPlanCommandHandler : IRequestHandler<CreateExamPlanCommand, Result<ExamPlanDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICourseRepository _courses;
    private readonly IExamPlanRepository _examPlans;
    private readonly IUserTimeZone _timeZone;

    public CreateExamPlanCommandHandler(IUnitOfWork unitOfWork, ICourseRepository courses, IExamPlanRepository examPlans, IUserTimeZone timeZone)
    {
        _unitOfWork = unitOfWork;
        _courses = courses;
        _examPlans = examPlans;
        _timeZone = timeZone;
    }

    public async Task<Result<ExamPlanDto>> Handle(CreateExamPlanCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result<ExamPlanDto>.Failure("Title is required.", "TITLE_REQUIRED");
        // The exam date is a date on the user's calendar, so "past" is judged against their today, not UTC's.
        var today = await UserTodayAsync(_timeZone, request.UserId, cancellationToken);
        if (request.ExamDate.Date < today)
            return Result<ExamPlanDto>.Failure("Exam date must be in the future.", "DATE_IN_PAST");

        string? courseName = null;
        if (request.CourseId.HasValue)
        {
            var course = await _courses.GetOwnedAsync(request.CourseId.Value, request.UserId, cancellationToken);
            if (course == null)
                return Result<ExamPlanDto>.Failure("Course not found.", "COURSE_NOT_FOUND");
            courseName = course.CourseName;
        }

        var plan = new ExamPlan
        {
            ExamPlanId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            Title = request.Title.Trim(),
            ExamDate = DateTime.SpecifyKind(request.ExamDate.Date, DateTimeKind.Utc),
            DailyMinutes = Math.Clamp(request.DailyMinutes, 10, 480),
            CreatedAt = DateTime.UtcNow,
        };
        await _examPlans.AddAsync(plan, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ExamPlanDto>.Success(ToDto(plan, courseName, today), "Exam plan created.");
    }

    internal static async Task<DateTime> UserTodayAsync(IUserTimeZone timeZone, Guid userId, CancellationToken ct)
        => UserCalendar.LocalDate(DateTime.UtcNow, await timeZone.ForUserAsync(userId, ct));

    /// <param name="today">The user's calendar date (see <see cref="UserTodayAsync"/>).</param>
    internal static ExamPlanDto ToDto(ExamPlan plan, string? courseName, DateTime today) => new(
        plan.ExamPlanId, plan.CourseId, courseName, plan.Title, plan.ExamDate, plan.DailyMinutes,
        Math.Max(0, (plan.ExamDate.Date - today.Date).Days), plan.CreatedAt);
}

public class DeleteExamPlanCommandHandler : IRequestHandler<DeleteExamPlanCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IExamPlanRepository _examPlans;

    public DeleteExamPlanCommandHandler(IUnitOfWork unitOfWork, IExamPlanRepository examPlans)
    {
        _unitOfWork = unitOfWork;
        _examPlans = examPlans;
    }

    public async Task<Result<bool>> Handle(DeleteExamPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await _examPlans.FirstOrDefaultAsync(
            p => p.ExamPlanId == request.PlanId && p.UserId == request.UserId, cancellationToken);
        if (plan == null)
            return Result<bool>.Failure("Exam plan not found.", "PLAN_NOT_FOUND");

        _examPlans.Remove(plan);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Exam plan deleted.");
    }
}

public class GetExamPlansQueryHandler : IRequestHandler<GetExamPlansQuery, Result<IReadOnlyList<ExamPlanDto>>>
{
    private readonly ICourseRepository _courses;
    private readonly IExamPlanRepository _examPlans;
    private readonly IUserTimeZone _timeZone;

    public GetExamPlansQueryHandler(ICourseRepository courses, IExamPlanRepository examPlans, IUserTimeZone timeZone)
    {
        _courses = courses;
        _examPlans = examPlans;
        _timeZone = timeZone;
    }

    public async Task<Result<IReadOnlyList<ExamPlanDto>>> Handle(GetExamPlansQuery request, CancellationToken cancellationToken)
    {
        var plans = (await _examPlans.FindAsync(p => p.UserId == request.UserId, cancellationToken)).ToList();
        var courses = (await _courses.FindAsync(c => c.UserId == request.UserId, cancellationToken))
            .ToDictionary(c => c.CourseId, c => c.CourseName);
        var today = await CreateExamPlanCommandHandler.UserTodayAsync(_timeZone, request.UserId, cancellationToken);

        var items = plans
            .OrderBy(p => p.ExamDate)
            .Select(p => CreateExamPlanCommandHandler.ToDto(
                p, p.CourseId.HasValue && courses.TryGetValue(p.CourseId.Value, out var name) ? name : null, today))
            .ToList();

        return Result<IReadOnlyList<ExamPlanDto>>.Success(items);
    }
}
