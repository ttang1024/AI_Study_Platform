using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Gamification;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record DigestDayDto(DateTime Date, int Minutes);

public record WeeklyDigestDto(
    DateTime From,
    DateTime To,
    int StudyMinutes,
    int ActiveDays,
    IReadOnlyList<DigestDayDto> DailyMinutes,
    int FlashcardReviews,
    int QuizzesTaken,
    double QuizAccuracy,
    int NewMaterials,
    int MistakesResolved,
    int OpenMistakes,
    int CurrentStreak,
    int WeeklyXp,
    string? TopGapConcept,
    string? TopGapReason,
    string Headline);

// ── Query ───────────────────────────────────────────────────────────────────

/// <summary>Computes the "your week in review" digest from the last 7 days of activity.</summary>
public record GetWeeklyDigestQuery(Guid UserId) : IRequest<Result<WeeklyDigestDto>>;

public class GetWeeklyDigestQueryHandler : IRequestHandler<GetWeeklyDigestQuery, Result<WeeklyDigestDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public GetWeeklyDigestQueryHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<WeeklyDigestDto>> Handle(GetWeeklyDigestQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;
        var to = DateTime.UtcNow;
        var from = to.Date.AddDays(-6); // 7 calendar days including today

        var sessions = (await _unitOfWork.StudySessions.FindAsNoTrackingAsync(
            s => s.UserId == userId && s.OccurredAt >= from, cancellationToken)).ToList();
        var minutesByDay = sessions
            .GroupBy(s => s.OccurredAt.Date)
            .ToDictionary(g => g.Key, g => g.Sum(s => s.DurationSeconds) / 60);
        var dailyMinutes = Enumerable.Range(0, 7)
            .Select(i => from.AddDays(i))
            .Select(d => new DigestDayDto(d, minutesByDay.GetValueOrDefault(d)))
            .ToList();
        var studyMinutes = dailyMinutes.Sum(d => d.Minutes);
        var activeDays = dailyMinutes.Count(d => d.Minutes > 0);

        var reviews = await _unitOfWork.FlashcardSrs.CountAsync(
            s => s.UserId == userId && s.LastReview != null && s.LastReview >= from, cancellationToken);

        var submissions = (await _unitOfWork.QuizSubmissions.FindAsNoTrackingAsync(
            s => s.UserId == userId && s.SubmittedAt >= from, cancellationToken)).ToList();
        var quizCorrect = submissions.Sum(s => s.Score);
        var quizTotal = submissions.Sum(s => s.Total);

        var newDocs = await _unitOfWork.Documents.CountAsync(
            d => d.UserId == userId && d.CreatedAt >= from, cancellationToken);
        var newVideos = await _unitOfWork.Videos.CountAsync(
            v => v.UserId == userId && v.CreatedAt >= from, cancellationToken);

        var mistakesResolved = await _unitOfWork.MistakeEntries.CountAsync(
            m => m.UserId == userId && m.ResolvedAt != null && m.ResolvedAt >= from, cancellationToken);
        var openMistakes = await _unitOfWork.MistakeEntries.CountAsync(
            m => m.UserId == userId && m.Status == "open", cancellationToken);

        var summary = (await _mediator.Send(new GetDashboardSummaryQuery(userId), cancellationToken)).Data!;

        var gaps = (await _mediator.Send(new GetKnowledgeGapsQuery(userId), cancellationToken)).Data!;
        var topGap = gaps.Gaps.FirstOrDefault();

        var weeklyXp = studyMinutes * XpMath.XpPerStudyMinute
                       + quizCorrect * XpMath.XpPerQuizCorrect
                       + reviews * XpMath.XpPerFlashcardRep;

        var headline = BuildHeadline(studyMinutes, activeDays, summary.Streak.CurrentStreak, reviews);

        return Result<WeeklyDigestDto>.Success(new WeeklyDigestDto(
            from, to, studyMinutes, activeDays, dailyMinutes,
            reviews, submissions.Count, quizTotal == 0 ? 0 : Math.Round(100.0 * quizCorrect / quizTotal, 1),
            newDocs + newVideos, mistakesResolved, openMistakes,
            summary.Streak.CurrentStreak, weeklyXp,
            topGap?.Concept, topGap?.Reason, headline));
    }

    private static string BuildHeadline(int minutes, int activeDays, int streak, int reviews)
    {
        if (minutes == 0) return "Quiet week — even 10 minutes today restarts the momentum.";
        if (activeDays >= 6) return $"Outstanding consistency: you studied {activeDays} of the last 7 days.";
        if (streak >= 7) return $"You're on a {streak}-day streak — keep it rolling!";
        if (reviews >= 50) return $"Review machine: {reviews} flashcards cleared this week.";
        return $"You put in {minutes} minutes across {activeDays} day{(activeDays == 1 ? "" : "s")} this week.";
    }
}
