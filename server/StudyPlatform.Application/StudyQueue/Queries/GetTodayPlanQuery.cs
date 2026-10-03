using MediatR;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;

namespace StudyPlatform.Application.StudyQueue.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

/// <summary>
/// One actionable line in today's study plan, with a rough time estimate so the plan can be
/// budgeted against the user's daily goal. <c>Stretch</c> marks items that fall beyond that
/// budget — still worth doing, but presented as optional extras.
/// </summary>
public record TodayPlanItemDto(
    string Id,
    string Type,            // flashcards | quiz | glossary | problems | gap | course | material
    string Title,
    string Subtitle,
    int Priority,
    int EstimatedMinutes,
    string? Url,
    int? Count,
    bool Stretch);

/// <summary>
/// The "Today" view: the user's streak/goal progress plus a single ordered plan that stitches the
/// recommendation queue and top knowledge gaps into one place to start studying.
/// </summary>
public record TodayPlanDto(
    StudyStreakDto Streak,
    int DailyGoalMinutes,
    int TodayMinutes,
    int CompletionPercent,
    bool GoalMet,
    int PlannedMinutes,
    int DueFlashcards,
    IEnumerable<TodayPlanItemDto> Items,
    DateTime GeneratedAt);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Composes today's study plan. Rather than recompute anything, it blends the already-cached
/// dashboard summary (streak / goal / due cards), the heuristic recommendation queue, and the
/// highest-severity knowledge gaps into one ranked, time-budgeted list.
/// </summary>
public record GetTodayPlanQuery(Guid UserId) : IRequest<Result<TodayPlanDto>>;

public class GetTodayPlanQueryHandler : IRequestHandler<GetTodayPlanQuery, Result<TodayPlanDto>>
{
    private const int MaxGaps = 3;
    private const int MaxItems = 8;
    private const int GapPriority = 55;          // ranks gaps among the mid-tier review items
    private const int FallbackBudgetMinutes = 15; // a small "core" budget once the goal is already met

    private readonly IMediator _mediator;

    public GetTodayPlanQueryHandler(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task<Result<TodayPlanDto>> Handle(GetTodayPlanQuery request, CancellationToken ct)
    {
        var userId = request.UserId;

        var summary = (await _mediator.Send(new GetDashboardSummaryQuery(userId), ct)).Data!;
        var recs = (await _mediator.Send(new GetRecommendationsQuery(userId), ct)).Data!;
        var gaps = (await _mediator.Send(new GetKnowledgeGapsQuery(userId), ct)).Data!;

        var candidates = new List<TodayPlanItemDto>();

        // Review-queue items — already ranked by the recommendation engine.
        foreach (var r in recs.ReviewQueue)
        {
            candidates.Add(new TodayPlanItemDto(
                r.Id, r.Type, r.Title, r.Reason, r.Priority,
                EstimateMinutes(r.Type, r.Count), r.Url, r.Count, Stretch: false));
        }

        // Top high-severity knowledge gaps as targeted closing tasks.
        foreach (var g in gaps.Gaps.Where(g => g.Severity == "high").Take(MaxGaps))
        {
            candidates.Add(new TodayPlanItemDto(
                $"gap-{g.Id}", "gap", $"Close gap: {g.Concept}", g.Reason, GapPriority,
                EstimateMinutes("gap", null), g.Url, Count: null, Stretch: false));
        }

        // Rank everything together; spaced-repetition due cards always lead (they're time-sensitive).
        var ranked = candidates
            .OrderByDescending(c => c.Type == "flashcards")
            .ThenByDescending(c => c.Priority)
            .Take(MaxItems)
            .ToList();

        // Split into "core" (fits today's remaining goal budget) and "stretch" (optional extras).
        var remaining = Math.Max(summary.DailyGoalMinutes - summary.Streak.TodayMinutes, 0);
        var budget = remaining > 0 ? remaining : Math.Min(summary.DailyGoalMinutes, FallbackBudgetMinutes);

        var items = new List<TodayPlanItemDto>(ranked.Count);
        var used = 0;
        for (var i = 0; i < ranked.Count; i++)
        {
            var isCore = i == 0 || used < budget;   // always keep at least the top item as core
            if (isCore) used += ranked[i].EstimatedMinutes;
            items.Add(ranked[i] with { Stretch = !isCore });
        }

        var plannedMinutes = items.Where(i => !i.Stretch).Sum(i => i.EstimatedMinutes);
        var completion = summary.DailyGoalMinutes > 0
            ? (int)Math.Clamp(Math.Round(summary.Streak.TodayMinutes * 100.0 / summary.DailyGoalMinutes), 0, 100)
            : 0;
        var goalMet = summary.DailyGoalMinutes > 0 && summary.Streak.TodayMinutes >= summary.DailyGoalMinutes;

        return Result<TodayPlanDto>.Success(new TodayPlanDto(
            summary.Streak, summary.DailyGoalMinutes, summary.Streak.TodayMinutes,
            completion, goalMet, plannedMinutes, summary.DueFlashcards, items, DateTime.UtcNow));
    }

    /// <summary>Rough per-item time estimate (minutes), scaled by the item's count where it has one.</summary>
    private static int EstimateMinutes(string type, int? count) => type switch
    {
        "flashcards" => Math.Clamp((int)Math.Ceiling((count ?? 1) * 0.2), 2, 20),
        "glossary"   => Math.Clamp((int)Math.Ceiling((count ?? 1) * 0.3), 2, 15),
        "problems"   => Math.Clamp((count ?? 1) * 2, 3, 20),
        "quiz"       => 5,
        "gap"        => 4,
        "course"     => 10,
        "material"   => 8,
        _            => 5,
    };
}
