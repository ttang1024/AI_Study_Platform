using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.StudyQueue.Queries;

namespace StudyPlatform.Application.Notifications;

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// <summary>
/// A single derived reminder for the notification bell. These are computed on demand from the
/// same signals the dashboard uses — there's no notifications table; read/dismissed state is
/// tracked client-side.
/// </summary>
public record NotificationDto(
    string Id,
    string Type,        // due | streak | goal | gap | review
    string Title,
    string Body,
    string? Url);

public record NotificationsDto(IReadOnlyList<NotificationDto> Items, int Count);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Builds the user's review-reminder digest: cards due, streak at risk, today's goal gap, the top
/// knowledge gap, and the highest-priority review suggestion. Pure composition over cached queries.
/// </summary>
public record GetNotificationsQuery(Guid UserId) : IRequest<Result<NotificationsDto>>;

public class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, Result<NotificationsDto>>
{
    private const int MaxReviewItems = 2;
    private const int MaxClassroomItems = 3;
    private const int ClassroomHorizonDays = 7;

    private readonly IMediator _mediator;

    public GetNotificationsQueryHandler(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task<Result<NotificationsDto>> Handle(GetNotificationsQuery request, CancellationToken ct)
    {
        var userId = request.UserId;
        var summary = (await _mediator.Send(new GetDashboardSummaryQuery(userId), ct)).Data!;
        var items = new List<NotificationDto>();

        // 1. Spaced-repetition cards due now.
        if (summary.DueFlashcards > 0)
        {
            items.Add(new NotificationDto(
                "due-flashcards", "due",
                $"{summary.DueFlashcards} card{(summary.DueFlashcards == 1 ? "" : "s")} due",
                "Review them now to keep your retention high.", "/flashcards"));
        }

        // 2. Streak at risk — there's a run going but nothing studied today yet.
        if (summary.Streak.CurrentStreak > 0 && summary.Streak.TodaySeconds == 0)
        {
            items.Add(new NotificationDto(
                "streak-risk", "streak",
                $"Keep your {summary.Streak.CurrentStreak}-day streak alive",
                "You haven’t studied yet today. A few minutes is enough.", "/today"));
        }

        // 3. Today's goal not yet met (but started) — gentle nudge with the remaining minutes.
        var remaining = summary.DailyGoalMinutes - summary.Streak.TodayMinutes;
        if (summary.Streak.TodaySeconds > 0 && remaining > 0)
        {
            items.Add(new NotificationDto(
                "goal-remaining", "goal",
                $"{remaining} min to today’s goal",
                $"You’re at {summary.Streak.TodayMinutes} of {summary.DailyGoalMinutes} minutes.", "/today"));
        }

        // 4. Classwork with a deadline. Ranked above the platform's own suggestions on purpose: a
        // missed assignment has a consequence outside the app that a skipped review does not.
        var deadlines = (await _mediator.Send(new GetClassroomDeadlinesQuery(userId, ClassroomHorizonDays), ct)).Data!;
        foreach (var d in deadlines.Take(MaxClassroomItems))
        {
            var due = d.IsOverdue
                ? $"Was due {d.DueAt:MMM d}"
                : d.DueAt.Date == DateTime.UtcNow.Date
                    ? "Due today"
                    : $"Due {d.DueAt:MMM d}";

            items.Add(new NotificationDto(
                $"classroom-{d.ClassroomAssignmentId?.ToString() ?? d.CourseId?.ToString() ?? d.ClassroomId.ToString()}",
                "due",
                d.IsOverdue ? $"Overdue: {d.Title}" : d.Title,
                $"{due} — {d.ClassroomName}.",
                $"/classrooms/{d.ClassroomId}"));
        }

        // 5. Top high-severity knowledge gap.
        var gaps = (await _mediator.Send(new GetKnowledgeGapsQuery(userId), ct)).Data!;
        var topGap = gaps.Gaps.FirstOrDefault(g => g.Severity == "high");
        if (topGap != null)
        {
            items.Add(new NotificationDto(
                $"gap-{topGap.Id}", "gap",
                $"Knowledge gap: {topGap.Concept}", topGap.Reason, topGap.Url));
        }

        // 6. A couple of the highest-priority review suggestions not already covered above.
        var recs = (await _mediator.Send(new GetRecommendationsQuery(userId), ct)).Data!;
        foreach (var r in recs.ReviewQueue.Where(r => r.Type is not "flashcards").Take(MaxReviewItems))
        {
            items.Add(new NotificationDto(
                $"review-{r.Id}", "review", r.Title, r.Reason, r.Url));
        }

        return Result<NotificationsDto>.Success(new NotificationsDto(items, items.Count));
    }
}
