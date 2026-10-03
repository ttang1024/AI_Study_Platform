using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

public record RecordStudySessionCommand(
    Guid UserId,
    Guid? CourseId,
    string ContextType,
    Guid? ContextId,
    int DurationSeconds) : IRequest<Result>;

public class RecordStudySessionCommandHandler : IRequestHandler<RecordStudySessionCommand, Result>
{
    // A single heartbeat should never represent more than a few minutes of wall-clock
    // time; clamp to guard against tab-sleep jumps and tampering.
    private const int MaxHeartbeatSeconds = 600;

    private readonly IUnitOfWork _unitOfWork;

    public RecordStudySessionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(RecordStudySessionCommand request, CancellationToken cancellationToken)
    {
        var seconds = Math.Clamp(request.DurationSeconds, 0, MaxHeartbeatSeconds);
        if (seconds == 0)
            return Result.Success("No time recorded.");

        var session = new StudySession
        {
            StudySessionId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            ContextType = string.IsNullOrWhiteSpace(request.ContextType) ? "general" : request.ContextType.Trim(),
            ContextId = request.ContextId,
            DurationSeconds = seconds,
            OccurredAt = DateTime.UtcNow,
        };

        await _unitOfWork.StudySessions.AddAsync(session, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Study session recorded.");
    }
}

public record GetTimeOnTaskQuery(Guid UserId, DateTime From, DateTime To) : IRequest<Result<TimeOnTaskDto>>;

public class GetTimeOnTaskQueryHandler : IRequestHandler<GetTimeOnTaskQuery, Result<TimeOnTaskDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetTimeOnTaskQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<TimeOnTaskDto>> Handle(GetTimeOnTaskQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"analytics:time-on-task:user:{request.UserId}:from:{request.From:yyyyMMdd}:to:{request.To:yyyyMMdd}";
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            async ct =>
            {
                var sessions = (await _unitOfWork.StudySessions.GetByDateRangeAsync(request.UserId, request.From, request.To, ct)).ToList();
                var courses = await _unitOfWork.Courses.GetListItemsByUserAsync(request.UserId, ct);
                var coursesById = courses.ToDictionary(c => c.CourseId);

                var daily = sessions
                    .GroupBy(s => s.OccurredAt.Date)
                    .Select(g =>
                    {
                        var total = g.Sum(s => s.DurationSeconds);
                        return new DailyStudyDurationDto(g.Key, total, (int)Math.Round(total / 60.0));
                    })
                    .OrderBy(d => d.Date)
                    .ToArray();

                var byCourse = sessions
                    .GroupBy(s => s.CourseId)
                    .Select(g =>
                    {
                        var course = g.Key.HasValue && coursesById.TryGetValue(g.Key.Value, out var c) ? c : null;
                        return new CourseTimeDto(
                            g.Key,
                            course?.CourseName ?? "Unattributed",
                            string.IsNullOrWhiteSpace(course?.CourseColor) ? null : course.CourseColor,
                            g.Sum(s => s.DurationSeconds));
                    })
                    .OrderByDescending(c => c.TotalSeconds)
                    .ToArray();

                return new TimeOnTaskDto(sessions.Sum(s => s.DurationSeconds), daily, byCourse);
            },
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<TimeOnTaskDto>.Success(result);
    }
}
