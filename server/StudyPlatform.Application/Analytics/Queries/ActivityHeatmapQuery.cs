using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

/// <summary>
/// Per-day study activity (flashcard reviews + study minutes) for the contributions-style
/// year heatmap. <paramref name="Days"/> is clamped to [30, 730].
/// </summary>
public record GetActivityHeatmapQuery(Guid UserId, int Days = 365) : IRequest<Result<ActivityHeatmapDto>>;

public class GetActivityHeatmapQueryHandler : IRequestHandler<GetActivityHeatmapQuery, Result<ActivityHeatmapDto>>
{
    private readonly IStudySessionRepository _studySessions;
    private readonly IFlashcardReviewLogRepository _flashcardReviewLogs;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;
    private readonly IUserTimeZone _timeZone;

    public GetActivityHeatmapQueryHandler(
        IStudySessionRepository studySessions, IFlashcardReviewLogRepository flashcardReviewLogs, IAppCache cache, IOptions<CacheOptions> cacheOptions, IUserTimeZone timeZone)
    {
        _studySessions = studySessions;
        _flashcardReviewLogs = flashcardReviewLogs;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
        _timeZone = timeZone;
    }

    public async Task<Result<ActivityHeatmapDto>> Handle(GetActivityHeatmapQuery request, CancellationToken cancellationToken)
    {
        var days = Math.Clamp(request.Days, 30, 730);
        var to = DateTime.UtcNow;

        // Cells are the user's local days; the window starts at local midnight of the first one.
        var zone = await _timeZone.ForUserAsync(request.UserId, cancellationToken);
        var firstDay = UserCalendar.LocalDate(to, zone).AddDays(-(days - 1));
        var from = UserCalendar.StartOfDayUtc(firstDay, zone);

        var cacheKey = $"analytics:activity-heatmap:user:{request.UserId}:days:{days}:tz:{zone.Id}";
        var dto = await _cache.GetOrCreateAsync(
            cacheKey,
            async ct =>
            {
                var reviewsByDay = (await _flashcardReviewLogs.GetByUserAsync(request.UserId, from, ct))
                    .GroupBy(l => UserCalendar.LocalDate(l.ReviewedAt, zone))
                    .ToDictionary(g => g.Key, g => g.Count());

                var minutesByDay = (await _studySessions.GetByDateRangeAsync(request.UserId, from, to, ct))
                    .GroupBy(s => UserCalendar.LocalDate(s.OccurredAt, zone))
                    .ToDictionary(g => g.Key, g => (int)Math.Round(g.Sum(s => s.DurationSeconds) / 60.0));

                var dayDtos = reviewsByDay.Keys
                    .Union(minutesByDay.Keys)
                    .OrderBy(d => d)
                    .Select(d => new ActivityHeatmapDayDto(
                        d,
                        reviewsByDay.GetValueOrDefault(d),
                        minutesByDay.GetValueOrDefault(d)))
                    .ToList();

                return new ActivityHeatmapDto(
                    from, to, dayDtos,
                    TotalReviews: dayDtos.Sum(d => d.Reviews),
                    TotalStudyMinutes: dayDtos.Sum(d => d.StudyMinutes),
                    ActiveDays: dayDtos.Count);
            },
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<ActivityHeatmapDto>.Success(dto);
    }
}
