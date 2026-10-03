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

    public CreateExamPlanCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ExamPlanDto>> Handle(CreateExamPlanCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result<ExamPlanDto>.Failure("Title is required.", "TITLE_REQUIRED");
        if (request.ExamDate.Date < DateTime.UtcNow.Date)
            return Result<ExamPlanDto>.Failure("Exam date must be in the future.", "DATE_IN_PAST");

        string? courseName = null;
        if (request.CourseId.HasValue)
        {
            var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId.Value, cancellationToken);
            if (course == null || course.UserId != request.UserId)
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
        await _unitOfWork.ExamPlans.AddAsync(plan, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ExamPlanDto>.Success(ToDto(plan, courseName), "Exam plan created.");
    }

    internal static ExamPlanDto ToDto(ExamPlan plan, string? courseName) => new(
        plan.ExamPlanId, plan.CourseId, courseName, plan.Title, plan.ExamDate, plan.DailyMinutes,
        Math.Max(0, (plan.ExamDate.Date - DateTime.UtcNow.Date).Days), plan.CreatedAt);
}

public class DeleteExamPlanCommandHandler : IRequestHandler<DeleteExamPlanCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteExamPlanCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteExamPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await _unitOfWork.ExamPlans.FirstOrDefaultAsync(
            p => p.ExamPlanId == request.PlanId && p.UserId == request.UserId, cancellationToken);
        if (plan == null)
            return Result<bool>.Failure("Exam plan not found.", "PLAN_NOT_FOUND");

        _unitOfWork.ExamPlans.Remove(plan);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Exam plan deleted.");
    }
}

public class GetExamPlansQueryHandler : IRequestHandler<GetExamPlansQuery, Result<IReadOnlyList<ExamPlanDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetExamPlansQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<ExamPlanDto>>> Handle(GetExamPlansQuery request, CancellationToken cancellationToken)
    {
        var plans = (await _unitOfWork.ExamPlans.FindAsync(p => p.UserId == request.UserId, cancellationToken)).ToList();
        var courses = (await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken))
            .ToDictionary(c => c.CourseId, c => c.CourseName);

        var items = plans
            .OrderBy(p => p.ExamDate)
            .Select(p => CreateExamPlanCommandHandler.ToDto(
                p, p.CourseId.HasValue && courses.TryGetValue(p.CourseId.Value, out var name) ? name : null))
            .ToList();

        return Result<IReadOnlyList<ExamPlanDto>>.Success(items);
    }
}
