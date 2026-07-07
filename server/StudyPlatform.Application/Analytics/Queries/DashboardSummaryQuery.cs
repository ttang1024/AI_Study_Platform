using System.Text.Json;
using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

/// <summary>
/// One round-trip powering the dashboard's at-a-glance widgets: the study streak / today's time,
/// the count of FSRS cards due now, and the three reinforcement counts. Computing the reinforcement
/// counts here (rather than shipping every submission/flashcard/term to the browser) is the whole
/// point — the dashboard used to pull all of that client-side on every load.
/// </summary>
public record GetDashboardSummaryQuery(Guid UserId) : IRequest<Result<DashboardSummaryDto>>;

internal static class DashboardSummaryCache
{
    public static string Key(Guid userId) => $"dashboard-summary:user:{userId}";
}

/// <summary>Updates the user's daily study-time goal (minutes). Clamped to a sane range.</summary>
public record UpdateDailyGoalCommand(Guid UserId, int Minutes) : IRequest<Result>;

public class UpdateDailyGoalCommandHandler : IRequestHandler<UpdateDailyGoalCommand, Result>
{
    private const int MinGoalMinutes = 5;
    private const int MaxGoalMinutes = 600;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;

    public UpdateDailyGoalCommandHandler(IUnitOfWork unitOfWork, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
    }

    public async Task<Result> Handle(UpdateDailyGoalCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result.Failure("User not found.", "USER_NOT_FOUND");

        user.DailyStudyGoalMinutes = Math.Clamp(request.Minutes, MinGoalMinutes, MaxGoalMinutes);
        user.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Drop the cached summary so the next dashboard load reflects the new goal immediately.
        await _cache.RemoveAsync(DashboardSummaryCache.Key(request.UserId), cancellationToken);

        return Result.Success("Daily goal updated.");
    }
}

public class GetDashboardSummaryQueryHandler : IRequestHandler<GetDashboardSummaryQuery, Result<DashboardSummaryDto>>
{
    // How far back to look when reconstructing the streak. Generous enough for any realistic run.
    private const int StreakLookbackDays = 400;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetDashboardSummaryQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<DashboardSummaryDto>> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var result = await _cache.GetOrCreateAsync(
            DashboardSummaryCache.Key(request.UserId),
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<DashboardSummaryDto>.Success(result);
    }

    private async Task<DashboardSummaryDto> ComputeAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        var streak = await ComputeStreakAsync(userId, now, ct);
        var dueFlashcards = (await _unitOfWork.FlashcardSrs.GetDueByUserIdAsync(userId, now, ct)).Count();
        var reinforcement = await ComputeReinforcementCountsAsync(userId, ct);

        var user = await _unitOfWork.Users.GetByIdAsync(userId, ct);
        var dailyGoalMinutes = user?.DailyStudyGoalMinutes ?? 30;

        return new DashboardSummaryDto(streak, dueFlashcards, reinforcement, dailyGoalMinutes);
    }

    private async Task<StudyStreakDto> ComputeStreakAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var sessions = await _unitOfWork.StudySessions.GetByDateRangeAsync(userId, now.AddDays(-StreakLookbackDays), now, ct);
        var sessionList = sessions.ToList();

        var today = now.Date;
        var todaySeconds = sessionList.Where(s => s.OccurredAt.Date == today).Sum(s => s.DurationSeconds);

        // Distinct UTC days with any recorded study time (consistent with the rest of analytics, which group on OccurredAt.Date).
        var studyDays = sessionList.Where(s => s.DurationSeconds > 0).Select(s => s.OccurredAt.Date).ToHashSet();

        // Current streak: count back from today (or yesterday, so a not-yet-studied today doesn't break it).
        var cursor = studyDays.Contains(today) ? today
            : studyDays.Contains(today.AddDays(-1)) ? today.AddDays(-1)
            : (DateTime?)null;
        var current = 0;
        while (cursor.HasValue && studyDays.Contains(cursor.Value))
        {
            current++;
            cursor = cursor.Value.AddDays(-1);
        }

        // Longest streak: longest run of consecutive days in the window.
        var longest = 0;
        var run = 0;
        DateTime? prev = null;
        foreach (var day in studyDays.OrderBy(d => d))
        {
            run = prev.HasValue && day == prev.Value.AddDays(1) ? run + 1 : 1;
            longest = Math.Max(longest, run);
            prev = day;
        }

        return new StudyStreakDto(current, longest, todaySeconds, (int)Math.Round(todaySeconds / 60.0));
    }

    private async Task<ReinforcementCountsDto> ComputeReinforcementCountsAsync(Guid userId, CancellationToken ct)
    {
        // Hard flashcards.
        var flashcards = await _unitOfWork.Flashcards.GetByUserIdAsync(userId, ct);
        var hardFlashcards = flashcards.Count(f => string.Equals(f.Difficulty, "hard", StringComparison.OrdinalIgnoreCase));

        // Unmastered glossary terms.
        var allTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct)).ToList();
        var mastered = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var unmasteredTerms = allTerms.Count(t => !mastered.Contains(t.GlossaryTermId));

        // Quiz mistakes: questions answered wrong at least once and never since answered correctly.
        var quizMistakes = await ComputeQuizMistakesAsync(userId, ct);

        return new ReinforcementCountsDto(quizMistakes, unmasteredTerms, hardFlashcards);
    }

    private async Task<int> ComputeQuizMistakesAsync(Guid userId, CancellationToken ct)
    {
        var quizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.UserId == userId, ct)).ToList();
        if (quizzes.Count == 0)
            return 0;

        var byId = quizzes.GroupBy(q => q.QuizId).ToDictionary(g => g.Key, g => g.First());
        var submissions = await _unitOfWork.QuizSubmissions.GetAllByUserAsync(userId, ct);

        var seen = new HashSet<Guid>();        // wrong at least once
        var everCorrect = new HashSet<Guid>(); // correct at least once (overrides "seen")

        foreach (var submission in submissions)
        {
            var answers = DeserializeAnswers(submission.AnswersJson);
            if (answers.Count == 0)
                continue;

            // Prefer questions belonging to this submission's source; fall back to whatever the answer keys resolve to.
            var isVideo = submission.VideoId.HasValue || submission.SourceType == "video";
            var sourceQuestions = quizzes.Where(q => isVideo
                    ? q.SourceType == "video" && q.VideoId == submission.VideoId
                    : q.SourceType == "document" && q.DocumentId == submission.DocumentId)
                .ToList();

            var candidates = sourceQuestions.Count > 0
                ? sourceQuestions
                : answers.Keys
                    .Select(id => Guid.TryParse(id, out var g) && byId.TryGetValue(g, out var q) ? q : null)
                    .Where(q => q != null)
                    .Select(q => q!)
                    .ToList();

            foreach (var question in candidates)
            {
                if (!answers.TryGetValue(question.QuizId.ToString(), out var answer))
                    continue;

                if (!string.IsNullOrEmpty(answer) && QuizAnswerComparer.IsCorrect(answer, question.CorrectAnswer))
                    everCorrect.Add(question.QuizId);
                else
                    seen.Add(question.QuizId);
            }
        }

        seen.ExceptWith(everCorrect);
        return seen.Count;
    }

    private static Dictionary<string, string> DeserializeAnswers(string answersJson)
    {
        if (string.IsNullOrWhiteSpace(answersJson))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson);
            return parsed == null
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(parsed, StringComparer.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
