using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Calendar;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record CalendarFeedDto(Guid Id, string Name, string Url, DateTime? LastSyncedAt, string? LastError, DateTime CreatedAt);

public record BusyBlockDto(DateTime Start, DateTime End, string Title, bool AllDay, string FeedName);

/// <summary>Per-day rollup the planner uses to schedule around commitments.</summary>
public record DayBusySummaryDto(DateTime Date, int BusyMinutes, IReadOnlyList<BusyBlockDto> Blocks);

public record BusyTimesDto(IReadOnlyList<DayBusySummaryDto> Days);

public record AddCalendarFeedRequest(string Name, string Url);

// ── Feed CRUD ───────────────────────────────────────────────────────────────

public record GetCalendarFeedsQuery(Guid UserId) : IRequest<Result<IReadOnlyList<CalendarFeedDto>>>;

public record AddCalendarFeedCommand(Guid UserId, string Name, string Url) : IRequest<Result<CalendarFeedDto>>;

public record RemoveCalendarFeedCommand(Guid UserId, Guid FeedId) : IRequest<Result>;

/// <summary>Merged busy blocks from all the user's feeds over [From, To), grouped per day.</summary>
public record GetBusyTimesQuery(Guid UserId, DateTime From, DateTime To) : IRequest<Result<BusyTimesDto>>;

public class GetCalendarFeedsQueryHandler : IRequestHandler<GetCalendarFeedsQuery, Result<IReadOnlyList<CalendarFeedDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetCalendarFeedsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IReadOnlyList<CalendarFeedDto>>> Handle(GetCalendarFeedsQuery request, CancellationToken ct)
    {
        var feeds = await _unitOfWork.UserCalendarFeeds.FindAsync(f => f.UserId == request.UserId, ct);
        var dtos = feeds
            .OrderBy(f => f.CreatedAt)
            .Select(f => new CalendarFeedDto(f.Id, f.Name, f.Url, f.LastSyncedAt, f.LastError, f.CreatedAt))
            .ToList();
        return Result<IReadOnlyList<CalendarFeedDto>>.Success(dtos);
    }
}

public class AddCalendarFeedCommandHandler : IRequestHandler<AddCalendarFeedCommand, Result<CalendarFeedDto>>
{
    private const int MaxFeedsPerUser = 5;

    private readonly IUnitOfWork _unitOfWork;
    private readonly ICalendarFeedService _feedService;

    public AddCalendarFeedCommandHandler(IUnitOfWork unitOfWork, ICalendarFeedService feedService)
    {
        _unitOfWork = unitOfWork;
        _feedService = feedService;
    }

    public async Task<Result<CalendarFeedDto>> Handle(AddCalendarFeedCommand request, CancellationToken ct)
    {
        var url = (request.Url ?? "").Trim();
        var isHttp = Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == "webcal");
        if (!isHttp)
            return Result<CalendarFeedDto>.Failure("Enter a valid ICS URL (https:// or webcal://).", "INVALID_URL");

        var existing = (await _unitOfWork.UserCalendarFeeds.FindAsync(f => f.UserId == request.UserId, ct)).ToList();
        if (existing.Count >= MaxFeedsPerUser)
            return Result<CalendarFeedDto>.Failure($"You can subscribe to at most {MaxFeedsPerUser} calendars.", "TOO_MANY_FEEDS");
        if (existing.Any(f => f.Url == url))
            return Result<CalendarFeedDto>.Failure("This calendar is already connected.", "DUPLICATE_FEED");

        // Validate by fetching once before saving.
        try
        {
            await _feedService.FetchBusyBlocksAsync(url, DateTime.UtcNow, DateTime.UtcNow.AddDays(1), ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return Result<CalendarFeedDto>.Failure("Couldn't fetch that calendar. Check the URL is a public/secret ICS address.", "FETCH_FAILED");
        }

        var feed = new UserCalendarFeed
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Name = string.IsNullOrWhiteSpace(request.Name) ? "Calendar" : request.Name.Trim(),
            Url = url,
            LastSyncedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };
        await _unitOfWork.UserCalendarFeeds.AddAsync(feed, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Result<CalendarFeedDto>.Success(
            new CalendarFeedDto(feed.Id, feed.Name, feed.Url, feed.LastSyncedAt, null, feed.CreatedAt),
            "Calendar connected.");
    }
}

public class RemoveCalendarFeedCommandHandler : IRequestHandler<RemoveCalendarFeedCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public RemoveCalendarFeedCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(RemoveCalendarFeedCommand request, CancellationToken ct)
    {
        var feed = await _unitOfWork.UserCalendarFeeds.GetByIdAsync(request.FeedId, ct);
        if (feed == null || feed.UserId != request.UserId)
            return Result.Failure("Calendar not found.", "FEED_NOT_FOUND");

        _unitOfWork.UserCalendarFeeds.Remove(feed);
        await _unitOfWork.SaveChangesAsync(ct);
        return Result.Success("Calendar removed.");
    }
}

public class GetBusyTimesQueryHandler : IRequestHandler<GetBusyTimesQuery, Result<BusyTimesDto>>
{
    private const int MaxHorizonDays = 31;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(15);

    private readonly IUnitOfWork _unitOfWork;
    private readonly ICalendarFeedService _feedService;
    private readonly IAppCache _cache;
    private readonly ILogger<GetBusyTimesQueryHandler> _logger;

    public GetBusyTimesQueryHandler(
        IUnitOfWork unitOfWork, ICalendarFeedService feedService, IAppCache cache, ILogger<GetBusyTimesQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _feedService = feedService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<BusyTimesDto>> Handle(GetBusyTimesQuery request, CancellationToken ct)
    {
        var from = request.From.Date;
        var to = request.To.Date;
        if (to <= from)
            to = from.AddDays(7);
        if ((to - from).TotalDays > MaxHorizonDays)
            to = from.AddDays(MaxHorizonDays);

        var result = await _cache.GetOrCreateAsync(
            $"busy-times:{request.UserId}:{from:yyyyMMdd}:{to:yyyyMMdd}",
            async innerCt => await ComputeAsync(request.UserId, from, to, innerCt),
            CacheTtl,
            ct);

        return Result<BusyTimesDto>.Success(result);
    }

    private async Task<BusyTimesDto> ComputeAsync(Guid userId, DateTime from, DateTime to, CancellationToken ct)
    {
        var feeds = (await _unitOfWork.UserCalendarFeeds.FindAsync(f => f.UserId == userId, ct)).ToList();
        var allBlocks = new List<BusyBlockDto>();

        foreach (var feed in feeds)
        {
            try
            {
                var blocks = await _feedService.FetchBusyBlocksAsync(feed.Url, from, to, ct);
                allBlocks.AddRange(blocks.Select(b => new BusyBlockDto(b.Start, b.End, b.Title, b.AllDay, feed.Name)));
                feed.LastSyncedAt = DateTime.UtcNow;
                feed.LastError = null;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or FormatException)
            {
                _logger.LogWarning(ex, "Calendar feed {FeedId} failed to sync", feed.Id);
                feed.LastError = ex.Message;
            }
            _unitOfWork.UserCalendarFeeds.Update(feed);
        }
        if (feeds.Count > 0)
            await _unitOfWork.SaveChangesAsync(ct);

        // Group into per-day summaries; timed blocks contribute their overlap with each day.
        var days = new List<DayBusySummaryDto>();
        for (var day = from; day < to; day = day.AddDays(1))
        {
            var dayEnd = day.AddDays(1);
            var todays = allBlocks
                .Where(b => b.Start < dayEnd && b.End > day)
                .OrderBy(b => b.Start)
                .ToList();
            var busyMinutes = (int)todays
                .Where(b => !b.AllDay)
                .Sum(b => (Min(b.End, dayEnd) - Max(b.Start, day)).TotalMinutes);
            days.Add(new DayBusySummaryDto(day, busyMinutes, todays));
        }

        return new BusyTimesDto(days);
    }

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;
    private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;
}
