using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Planner;

/// <summary>
/// Back-plans daily study sessions from the exam date. Each day blends spaced review
/// (due cards), the user's open knowledge gaps and mistakes, and practice — with a mock
/// exam every few days and a light recap the day before the exam.
/// </summary>
public record GetExamScheduleQuery(Guid PlanId, Guid UserId) : IRequest<Result<ExamScheduleDto>>;

public class GetExamScheduleQueryHandler : IRequestHandler<GetExamScheduleQuery, Result<ExamScheduleDto>>
{
    private const int MaxDays = 21;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public GetExamScheduleQueryHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<ExamScheduleDto>> Handle(GetExamScheduleQuery request, CancellationToken cancellationToken)
    {
        var plan = await _unitOfWork.ExamPlans.FirstOrDefaultAsync(
            p => p.ExamPlanId == request.PlanId && p.UserId == request.UserId, cancellationToken);
        if (plan == null)
            return Result<ExamScheduleDto>.Failure("Exam plan not found.", "PLAN_NOT_FOUND");

        string? courseName = null;
        if (plan.CourseId.HasValue)
            courseName = (await _unitOfWork.Courses.GetByIdAsync(plan.CourseId.Value, cancellationToken))?.CourseName;

        var gaps = (await _mediator.Send(new GetKnowledgeGapsQuery(request.UserId), cancellationToken)).Data!;
        var relevantGaps = gaps.Gaps
            .Where(g => plan.CourseId == null || g.CourseIds.Contains(plan.CourseId.Value.ToString(), StringComparer.OrdinalIgnoreCase))
            .Take(12)
            .ToList();

        var openMistakes = await _unitOfWork.MistakeEntries.CountAsync(
            m => m.UserId == request.UserId && m.Status == "open", cancellationToken);

        var summary = (await _mediator.Send(new GetDashboardSummaryQuery(request.UserId), cancellationToken)).Data!;

        var today = DateTime.UtcNow.Date;
        var daysUntilExam = Math.Max(0, (plan.ExamDate.Date - today).Days);
        var planDays = Math.Min(daysUntilExam, MaxDays);

        var days = new List<PlanDayDto>();
        for (var i = 0; i < planDays; i++)
        {
            var date = today.AddDays(i);
            var daysLeft = daysUntilExam - i;
            var isFinalDay = daysLeft == 1;
            var tasks = new List<PlanTaskDto>();
            var minutes = plan.DailyMinutes;

            if (isFinalDay)
            {
                tasks.Add(new PlanTaskDto("review", "Light recap of weak concepts",
                    "Cramming hard the day before hurts retention — skim your mistake notebook and glossary instead.",
                    minutes, "/quizzes?tab=mistakes"));
                days.Add(new PlanDayDto(date, DayLabel(date, today), minutes, tasks));
                continue;
            }

            // Spaced review keeps retention compounding — it anchors every day.
            var reviewMinutes = Math.Max(5, (int)(minutes * 0.4));
            tasks.Add(new PlanTaskDto("flashcards", "Review due flashcards",
                summary.DueFlashcards > 0 ? $"{summary.DueFlashcards} cards are due — clear today's queue first." : "Keep the review queue empty.",
                reviewMinutes, "/flashcards"));

            // Rotate through the open gaps so each one gets focused time before the exam.
            var conceptMinutes = (int)(minutes * 0.3);
            if (relevantGaps.Count > 0)
            {
                var gap = relevantGaps[i % relevantGaps.Count];
                tasks.Add(new PlanTaskDto("concept", $"Close the gap: {gap.Concept}", gap.Reason, conceptMinutes, gap.Url));
            }
            else
            {
                tasks.Add(new PlanTaskDto("concept", "Deep-read one weak topic",
                    "No detected gaps — pick the chapter you're least confident about.", conceptMinutes, "/library"));
            }

            // Practice block: mock exam every third day, otherwise mistakes/questions.
            var practiceMinutes = minutes - reviewMinutes - conceptMinutes;
            if (i % 3 == 2)
            {
                tasks.Add(new PlanTaskDto("mock-exam", "Take a timed mock exam",
                    "Exam-condition practice is the strongest predictor of exam performance.", practiceMinutes,
                    plan.CourseId.HasValue ? $"/planner?mock={plan.CourseId}" : "/planner?mock=all"));
            }
            else if (openMistakes > 0)
            {
                tasks.Add(new PlanTaskDto("mistakes", "Work through your mistake notebook",
                    $"{openMistakes} unresolved mistake{(openMistakes == 1 ? "" : "s")} — these are your highest-yield questions.",
                    practiceMinutes, "/quizzes?tab=mistakes"));
            }
            else
            {
                tasks.Add(new PlanTaskDto("practice", "Practice quiz questions",
                    "Active recall beats re-reading.", practiceMinutes, "/quizzes"));
            }

            days.Add(new PlanDayDto(date, DayLabel(date, today), minutes, tasks));
        }

        var dto = new ExamScheduleDto(CreateExamPlanCommandHandler.ToDto(plan, courseName), days);
        return Result<ExamScheduleDto>.Success(dto);
    }

    private static string DayLabel(DateTime date, DateTime today) =>
        date == today ? "Today" : date == today.AddDays(1) ? "Tomorrow" : date.ToString("ddd, MMM d");
}
