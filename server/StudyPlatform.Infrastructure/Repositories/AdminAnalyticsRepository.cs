using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// Platform-wide analytics computed straight against the DbContext. Aggregations are pushed to
/// Postgres where it's cheap (counts, grouped sums); only the small grouped result sets are pulled
/// into memory to fill calendar gaps and derive the active-user windows.
/// </summary>
public class AdminAnalyticsRepository : IAdminAnalyticsRepository
{
    private readonly AppDbContext _db;

    public AdminAnalyticsRepository(AppDbContext db) => _db = db;

    public async Task<PlatformAnalytics> GetPlatformAnalyticsAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;
        var sevenDaysAgo = now.AddDays(-7);
        var thirtyDaysAgo = now.AddDays(-30);

        // ── Users ────────────────────────────────────────────────────────────────
        var totalUsers = await _db.Users.CountAsync(ct);
        var activeUsers = await _db.Users.CountAsync(u => u.IsActive, ct);
        var admins = await _db.Users.CountAsync(u => u.IsAdmin, ct);
        var verified = await _db.Users.CountAsync(u => u.IsEmailVerified, ct);
        var new7 = await _db.Users.CountAsync(u => u.CreatedAt >= sevenDaysAgo, ct);
        var new30 = await _db.Users.CountAsync(u => u.CreatedAt >= thirtyDaysAgo, ct);

        var userMetrics = new UserMetrics(
            totalUsers, activeUsers, totalUsers - activeUsers, admins, verified, new7, new30);

        // ── Content ──────────────────────────────────────────────────────────────
        var content = new ContentMetrics(
            Documents: await _db.Documents.CountAsync(ct),
            Courses: await _db.Courses.CountAsync(ct),
            Videos: await _db.YouTubeVideos.CountAsync(ct),
            Quizzes: await _db.Quizzes.CountAsync(ct),
            Flashcards: await _db.Flashcards.CountAsync(ct),
            Notes: await _db.Notes.CountAsync(ct),
            GlossaryTerms: await _db.GlossaryTerms.CountAsync(ct));

        // ── Signup trend (last 30 days, daily) ───────────────────────────────────
        var signupRaw = await _db.Users
            .Where(u => u.CreatedAt >= thirtyDaysAgo)
            .GroupBy(u => u.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var signupTrend = FillDailyGaps(signupRaw.ToDictionary(x => x.Date, x => x.Count), today, 30);

        // ── Active users: distinct (user, day) pairs over 30 days ────────────────
        var activePairs = await _db.StudySessions
            .Where(s => s.OccurredAt >= thirtyDaysAgo && s.DurationSeconds > 0)
            .GroupBy(s => new { Day = s.OccurredAt.Date, s.UserId })
            .Select(g => new { g.Key.Day, g.Key.UserId })
            .ToListAsync(ct);

        var dau = activePairs.Where(p => p.Day == today).Select(p => p.UserId).Distinct().Count();
        var wau = activePairs.Where(p => p.Day >= sevenDaysAgo.Date).Select(p => p.UserId).Distinct().Count();
        var mau = activePairs.Select(p => p.UserId).Distinct().Count();

        var perDayActive = activePairs
            .GroupBy(p => p.Day)
            .ToDictionary(g => g.Key, g => g.Select(p => p.UserId).Distinct().Count());
        var activeUsersTrend = FillDailyGaps(perDayActive, today, 14);

        // ── Engagement totals ────────────────────────────────────────────────────
        var studySecondsLast30 = await _db.StudySessions
            .Where(s => s.OccurredAt >= thirtyDaysAgo)
            .SumAsync(s => (long)s.DurationSeconds, ct);
        var studySessionsLast30 = await _db.StudySessions.CountAsync(s => s.OccurredAt >= thirtyDaysAgo, ct);
        var quizSubsLast30 = await _db.QuizSubmissions.CountAsync(s => s.SubmittedAt >= thirtyDaysAgo, ct);
        var totalQuizSubs = await _db.QuizSubmissions.CountAsync(ct);

        var engagement = new EngagementMetrics(
            dau, wau, mau,
            StudyMinutesLast30Days: studySecondsLast30 / 60,
            StudySessionsLast30Days: studySessionsLast30,
            QuizSubmissionsLast30Days: quizSubsLast30,
            TotalQuizSubmissions: totalQuizSubs);

        // ── Top users by study time (last 30 days) ───────────────────────────────
        var topRaw = await _db.StudySessions
            .Where(s => s.OccurredAt >= thirtyDaysAgo)
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                Seconds = g.Sum(x => (long)x.DurationSeconds),
                Sessions = g.Count(),
                LastActive = g.Max(x => x.OccurredAt),
            })
            .OrderByDescending(x => x.Seconds)
            .Take(10)
            .ToListAsync(ct);

        var topIds = topRaw.Select(x => x.UserId).ToList();
        var topUserInfo = await _db.Users
            .Where(u => topIds.Contains(u.UserId))
            .Select(u => new { u.UserId, u.FullName, u.Email })
            .ToListAsync(ct);
        var infoById = topUserInfo.ToDictionary(u => u.UserId);

        var topUsers = topRaw
            .Where(x => infoById.ContainsKey(x.UserId))
            .Select(x => new TopUser(
                x.UserId,
                infoById[x.UserId].FullName,
                infoById[x.UserId].Email,
                x.Seconds / 60,
                x.Sessions,
                x.LastActive))
            .ToList();

        return new PlatformAnalytics(userMetrics, engagement, content, signupTrend, activeUsersTrend, topUsers);
    }

    public async Task<UserActivityDetail?> GetUserDetailAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == userId, ct);
        if (user is null)
            return null;

        var now = DateTime.UtcNow;
        var today = now.Date;
        var thirtyDaysAgo = now.AddDays(-30);

        var content = new UserContentCounts(
            Courses: await _db.Courses.CountAsync(c => c.UserId == userId, ct),
            Documents: await _db.Documents.CountAsync(d => d.UserId == userId, ct),
            Videos: await _db.YouTubeVideos.CountAsync(v => v.UserId == userId, ct),
            Quizzes: await _db.Quizzes.CountAsync(q => q.UserId == userId, ct),
            Flashcards: await _db.Flashcards.CountAsync(f => f.UserId == userId, ct),
            Notes: await _db.Notes.CountAsync(n => n.UserId == userId, ct),
            GlossaryTerms: await _db.GlossaryTerms.CountAsync(g => g.UserId == userId, ct));

        var studySecondsTotal = await _db.StudySessions
            .Where(s => s.UserId == userId)
            .SumAsync(s => (long)s.DurationSeconds, ct);
        var studySeconds30 = await _db.StudySessions
            .Where(s => s.UserId == userId && s.OccurredAt >= thirtyDaysAgo)
            .SumAsync(s => (long)s.DurationSeconds, ct);
        var sessionsTotal = await _db.StudySessions.CountAsync(s => s.UserId == userId, ct);
        var lastActive = await _db.StudySessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.OccurredAt)
            .Select(s => (DateTime?)s.OccurredAt)
            .FirstOrDefaultAsync(ct);

        var quizSubs = await _db.QuizSubmissions.CountAsync(s => s.UserId == userId, ct);
        // Average percentage across submissions that actually had questions.
        var scored = await _db.QuizSubmissions
            .Where(s => s.UserId == userId && s.Total > 0)
            .Select(s => new { s.Score, s.Total })
            .ToListAsync(ct);
        double? avgScorePct = scored.Count > 0
            ? Math.Round(scored.Average(s => 100.0 * s.Score / s.Total), 1)
            : null;

        // Study trend: minutes per day over the last 14 days.
        var fourteenDaysAgo = now.AddDays(-14);
        var trendRaw = await _db.StudySessions
            .Where(s => s.UserId == userId && s.OccurredAt >= fourteenDaysAgo)
            .GroupBy(s => s.OccurredAt.Date)
            .Select(g => new { Date = g.Key, Seconds = g.Sum(x => (long)x.DurationSeconds) })
            .ToListAsync(ct);
        var trend = FillDailyGaps(
            trendRaw.ToDictionary(x => x.Date, x => (int)(x.Seconds / 60)), today, 14);

        return new UserActivityDetail(
            user.UserId, user.Email, user.FullName,
            user.IsAdmin, user.IsActive, user.IsEmailVerified,
            user.CreatedAt, lastActive,
            content,
            studySecondsTotal / 60, studySeconds30 / 60, sessionsTotal,
            quizSubs, avgScorePct,
            trend);
    }

    /// <summary>Produces one entry per day for the trailing <paramref name="days"/> window, filling absent days with 0.</summary>
    private static List<DailyCount> FillDailyGaps(IReadOnlyDictionary<DateTime, int> byDay, DateTime today, int days)
    {
        var result = new List<DailyCount>(days);
        for (var i = days - 1; i >= 0; i--)
        {
            var date = today.AddDays(-i);
            result.Add(new DailyCount(date, byDay.TryGetValue(date, out var c) ? c : 0));
        }
        return result;
    }
}
