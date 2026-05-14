# Analytics

## Routes

`AnalyticsController` is mounted at `/api/analytics`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/analytics/quiz-accuracy` | Daily quiz accuracy over a date range |
| `POST` | `/api/analytics/quiz-attempt` | Record a single quiz attempt result |

`StatsController` also exposes `GET /api/stats` for dashboard-level user stats.

## Implementation

Application code lives in `server/StudyPlatform.Application/Analytics`. Quiz accuracy uses `IAnalyticsRepository` to load attempts and caches aggregated results through `IAppCache` using `Cache:AnalyticsSummarySeconds`.

### Daily Quiz Accuracy Query

The cache key encodes user ID and the date range so different windows never collide. Inside the factory the handler groups raw attempts by calendar date and computes per-day accuracy.

```csharp
// AnalyticsQueries.cs — GetDailyQuizAccuracyQueryHandler
public async Task<Result<IEnumerable<DailyQuizAccuracyDto>>> Handle(
    GetDailyQuizAccuracyQuery request, CancellationToken ct)
{
    var cacheKey = $"analytics:quiz-accuracy:user:{request.UserId}" +
                   $":from:{request.From:yyyyMMdd}:to:{request.To:yyyyMMdd}";

    var result = await _cache.GetOrCreateAsync(
        cacheKey,
        async innerCt =>
        {
            var attempts = await _unitOfWork.Analytics
                .GetQuizAttemptsByDateRangeAsync(request.UserId, request.From, request.To, innerCt);

            return attempts
                .GroupBy(a => a.AttemptedAt.Date)
                .Select(g =>
                {
                    var total   = g.Count();
                    var correct = g.Count(a => a.IsCorrect);
                    return new DailyQuizAccuracyDto(
                        g.Key, total, correct,
                        total > 0 ? Math.Round((double)correct / total * 100, 2) : 0);
                })
                .OrderBy(d => d.Date)
                .ToArray();
        },
        TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
        ct);

    return Result<IEnumerable<DailyQuizAccuracyDto>>.Success(result);
}
```

### Record Quiz Attempt

Each quiz answer fires `RecordQuizAttemptCommand`, which persists a `QuizAttempt` row. The per-user accuracy cache is not invalidated on write — it expires naturally via `Cache:AnalyticsSummarySeconds`.

```csharp
// AnalyticsQueries.cs — RecordQuizAttemptCommandHandler
var attempt = new QuizAttempt
{
    AttemptId   = Guid.NewGuid(),
    UserId      = request.UserId,
    QuizId      = request.QuizId,
    IsCorrect   = request.IsCorrect,
    AttemptedAt = DateTime.UtcNow,
};
await _unitOfWork.Analytics.AddQuizAttemptAsync(attempt, cancellationToken);
await _unitOfWork.SaveChangesAsync(cancellationToken);
```

## Frontend

Dashboard charts and stat summaries are in `DashboardPage`, `AchievementsPanel`, `StudyCalendar`, `analyticsService.ts`, and `statsService.ts`.
