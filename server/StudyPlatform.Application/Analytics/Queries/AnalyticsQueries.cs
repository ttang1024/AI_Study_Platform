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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetDailyQuizAccuracyQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<IEnumerable<DailyQuizAccuracyDto>>> Handle(GetDailyQuizAccuracyQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"analytics:quiz-accuracy:user:{request.UserId}:from:{request.From:yyyyMMdd}:to:{request.To:yyyyMMdd}";
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            async ct =>
            {
                // Quiz activity lives in two stores: per-question QuizAttempt rows (practice/mock
                // tests) and per-quiz QuizSubmission rows with Score/Total (document & video
                // quizzes). The two are disjoint — practice tests never write submissions and
                // vice versa — so merging their per-day counts gives the complete picture.
                var attempts = await _unitOfWork.Analytics.GetQuizAttemptsByDateRangeAsync(request.UserId, request.From, request.To, ct);
                var submissions = await _unitOfWork.QuizSubmissions.GetByDateRangeAsync(request.UserId, request.From, request.To, ct);

                var byDay = new Dictionary<DateTime, (int Total, int Correct)>();

                foreach (var group in attempts.GroupBy(a => a.AttemptedAt.Date))
                {
                    byDay.TryGetValue(group.Key, out var day);
                    byDay[group.Key] = (day.Total + group.Count(), day.Correct + group.Count(a => a.IsCorrect));
                }

                foreach (var submission in submissions.Where(s => s.Total > 0))
                {
                    var date = submission.SubmittedAt.Date;
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

    public RecordQuizAttemptCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
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

        await _unitOfWork.Analytics.AddQuizAttemptAsync(attempt, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Quiz attempt recorded.");
    }
}
