using MediatR;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Microsoft.Extensions.Options;

namespace StudyPlatform.Application.Analytics.Queries;

public record GetDailyQuizAccuracyQuery(Guid UserId, DateTime From, DateTime To) : IRequest<Result<IEnumerable<DailyQuizAccuracyDto>>>;

public class GetDailyQuizAccuracyQueryHandler : IRequestHandler<GetDailyQuizAccuracyQuery, Result<IEnumerable<DailyQuizAccuracyDto>>>
{
    private readonly IAnalyticsRepository _analytics;
    private readonly IQuizSubmissionRepository _quizSubmissions;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    private readonly IUserTimeZone _timeZone;

    public GetDailyQuizAccuracyQueryHandler(
        IAnalyticsRepository analytics, IQuizSubmissionRepository quizSubmissions, IAppCache cache, IOptions<CacheOptions> cacheOptions, IUserTimeZone timeZone)
    {
        _timeZone = timeZone;
        _analytics = analytics;
        _quizSubmissions = quizSubmissions;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<IEnumerable<DailyQuizAccuracyDto>>> Handle(GetDailyQuizAccuracyQuery request, CancellationToken cancellationToken)
    {
        var zone = await _timeZone.ForUserAsync(request.UserId, cancellationToken);
        var cacheKey = $"analytics:quiz-accuracy:user:{request.UserId}:from:{request.From:yyyyMMdd}:to:{request.To:yyyyMMdd}:tz:{zone.Id}";
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            async ct =>
            {
                // Quiz activity lives in two stores: per-question QuizAttempt rows (practice/mock
                // tests) and per-quiz QuizSubmission rows with Score/Total (document & video
                // quizzes). The two are disjoint — practice tests never write submissions and
                // vice versa — so merging their per-day counts gives the complete picture.
                var attempts = await _analytics.GetQuizAttemptsByDateRangeAsync(request.UserId, request.From, request.To, ct);
                var submissions = await _quizSubmissions.GetByDateRangeAsync(request.UserId, request.From, request.To, ct);

                var byDay = new Dictionary<DateTime, (int Total, int Correct)>();

                foreach (var group in attempts.GroupBy(a => UserCalendar.LocalDate(a.AttemptedAt, zone)))
                {
                    byDay.TryGetValue(group.Key, out var day);
                    byDay[group.Key] = (day.Total + group.Count(), day.Correct + group.Count(a => a.IsCorrect));
                }

                foreach (var submission in submissions.Where(s => s.Total > 0))
                {
                    var date = UserCalendar.LocalDate(submission.SubmittedAt, zone);
                    byDay.TryGetValue(date, out var day);
                    byDay[date] = (day.Total + submission.Total, day.Correct + Math.Min(submission.Score, submission.Total));
                }

                return byDay
                    .Select(kv => new DailyQuizAccuracyDto(
                        kv.Key,
                        kv.Value.Total,
                        kv.Value.Correct,
                        kv.Value.Total > 0 ? Math.Round((double)kv.Value.Correct / kv.Value.Total * 100, 2) : 0))
                    .OrderBy(d => d.Date)
                    .ToArray();
            },
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<IEnumerable<DailyQuizAccuracyDto>>.Success(result);
    }
}

public record RecordQuizAttemptCommand(Guid UserId, Guid QuizId, bool IsCorrect) : IRequest<Result>;

public class RecordQuizAttemptCommandHandler : IRequestHandler<RecordQuizAttemptCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAnalyticsRepository _analytics;

    public RecordQuizAttemptCommandHandler(IUnitOfWork unitOfWork, IAnalyticsRepository analytics)
    {
        _unitOfWork = unitOfWork;
        _analytics = analytics;
    }

    public async Task<Result> Handle(RecordQuizAttemptCommand request, CancellationToken cancellationToken)
    {
        var attempt = new QuizAttempt
        {
            AttemptId = Guid.NewGuid(),
            UserId = request.UserId,
            QuizId = request.QuizId,
            IsCorrect = request.IsCorrect,
            AttemptedAt = DateTime.UtcNow,
        };

        await _analytics.AddQuizAttemptAsync(attempt, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Quiz attempt recorded.");
    }
}
