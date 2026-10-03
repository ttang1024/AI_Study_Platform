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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetActivityHeatmapQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<ActivityHeatmapDto>> Handle(GetActivityHeatmapQuery request, CancellationToken cancellationToken)
    {
        var days = Math.Clamp(request.Days, 30, 730);
        var to = DateTime.UtcNow;
        var from = to.Date.AddDays(-(days - 1));

        var cacheKey = $"analytics:activity-heatmap:user:{request.UserId}:days:{days}";
        var dto = await _cache.GetOrCreateAsync(
            cacheKey,
            async ct =>
            {
                var reviewsByDay = (await _unitOfWork.FlashcardReviewLogs.GetByUserAsync(request.UserId, from, ct))
                    .GroupBy(l => l.ReviewedAt.Date)
                    .ToDictionary(g => g.Key, g => g.Count());

                var minutesByDay = (await _unitOfWork.StudySessions.GetByDateRangeAsync(request.UserId, from, to, ct))
                    .GroupBy(s => s.OccurredAt.Date)
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
