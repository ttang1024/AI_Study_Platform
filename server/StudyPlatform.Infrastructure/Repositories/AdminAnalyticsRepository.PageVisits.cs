using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// The page-view half of the admin dashboard. Split out because it reads one table the rest never
/// touches — and the one that grows per page view rather than per user, so its queries are written
/// to keep everything that scales with traffic inside Postgres.
/// </summary>
public partial class AdminAnalyticsRepository
{
    /// <summary>Widest window the dashboard may ask for; the table is not kept longer than this anyway.</summary>
    private const int MaxWindowDays = 365;

    private const int TopPageCount = 12;
    private const int TopReferrerCount = 8;

    public async Task<PageVisitAnalytics> GetPageVisitAnalyticsAsync(int days, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, MaxWindowDays);

        var today = DateTime.UtcNow.Date;
        // Inclusive of today, so a 7-day window is today plus the six days before it.
        var from = today.AddDays(-(days - 1));

        var visits = _db.PageVisits.Where(v => v.OccurredAt >= from);

        var totalVisits = await visits.LongCountAsync(ct);
        if (totalVisits == 0)
        {
            return new PageVisitAnalytics(
                days,
                new PageVisitTotals(0, 0, 0, 0, 0, 0, 0, 0),
                FillDailyGaps(new Dictionary<DateTime, int>(), today, days),
                FillDailyGaps(new Dictionary<DateTime, int>(), today, days),
                Array.Empty<PagePopularity>(),
                Array.Empty<ReferrerCount>(),
                Array.Empty<DeviceCount>());
        }

        var uniqueVisitors = await visits.Select(v => v.VisitorId).Distinct().CountAsync(ct);
        var sessions = await visits.Select(v => v.SessionId).Distinct().CountAsync(ct);
        var visitsToday = await visits.LongCountAsync(v => v.OccurredAt >= today, ct);
        var visitsLast7 = await visits.LongCountAsync(v => v.OccurredAt >= today.AddDays(-6), ct);
        var signedIn = await visits.LongCountAsync(v => v.UserId != null, ct);

        var totals = new PageVisitTotals(
            Visits: totalVisits,
            UniqueVisitors: uniqueVisitors,
            Sessions: sessions,
            VisitsToday: visitsToday,
            VisitsLast7Days: visitsLast7,
            SignedInVisits: signedIn,
            AnonymousVisits: totalVisits - signedIn,
            VisitsPerSession: sessions > 0 ? Math.Round((double)totalVisits / sessions, 1) : 0);

        // ── Daily visits ─────────────────────────────────────────────────────────
        var visitsByDay = await visits
            .GroupBy(v => v.OccurredAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var visitTrend = FillDailyGaps(visitsByDay.ToDictionary(x => x.Date, x => x.Count), today, days);

        // ── Daily distinct visitors ──────────────────────────────────────────────
        // Grouped in Postgres to one row per (day, visitor); only that much crosses the wire,
        // and the second grouping is over a list bounded by visitors × days, not by traffic.
        var visitorDayPairs = await visits
            .GroupBy(v => new { Day = v.OccurredAt.Date, v.VisitorId })
            .Select(g => new { g.Key.Day, g.Key.VisitorId })
            .ToListAsync(ct);
        var visitorTrend = FillDailyGaps(
            visitorDayPairs.GroupBy(p => p.Day).ToDictionary(g => g.Key, g => g.Count()), today, days);

        // ── Top pages ────────────────────────────────────────────────────────────
        var topPageRows = await visits
            .GroupBy(v => v.Path)
            .Select(g => new { Path = g.Key, Visits = g.LongCount() })
            .OrderByDescending(x => x.Visits)
            .Take(TopPageCount)
            .ToListAsync(ct);

        var topPaths = topPageRows.Select(x => x.Path).ToList();
        var pageVisitorPairs = await visits
            .Where(v => topPaths.Contains(v.Path))
            .GroupBy(v => new { v.Path, v.VisitorId })
            .Select(g => new { g.Key.Path, g.Key.VisitorId })
            .ToListAsync(ct);
        var visitorsByPath = pageVisitorPairs
            .GroupBy(p => p.Path)
            .ToDictionary(g => g.Key, g => g.Count());

        var topPages = topPageRows
            .Select(x => new PagePopularity(
                x.Path, x.Visits, visitorsByPath.TryGetValue(x.Path, out var uv) ? uv : 0))
            .ToList();

        // ── Referrers and devices ────────────────────────────────────────────────
        // Projected to anonymous types rather than straight into the records: EF cannot translate a
        // positional record constructor inside a GroupBy projection.
        var referrerRows = await visits
            .Where(v => v.Referrer != null)
            .GroupBy(v => v.Referrer!)
            .Select(g => new { Referrer = g.Key, Visits = g.LongCount() })
            .OrderByDescending(x => x.Visits)
            .Take(TopReferrerCount)
            .ToListAsync(ct);
        var topReferrers = referrerRows.Select(x => new ReferrerCount(x.Referrer, x.Visits)).ToList();

        var deviceRows = await visits
            .GroupBy(v => v.Device)
            .Select(g => new { Device = g.Key, Visits = g.LongCount() })
            .OrderByDescending(x => x.Visits)
            .ToListAsync(ct);
        var devices = deviceRows.Select(x => new DeviceCount(x.Device, x.Visits)).ToList();

        return new PageVisitAnalytics(days, totals, visitTrend, visitorTrend, topPages, topReferrers, devices);
    }
}
