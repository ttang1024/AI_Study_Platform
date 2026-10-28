namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Platform-wide aggregation queries that power the admin analytics dashboard.
/// These read across every user's data (unlike the per-user IAnalyticsRepository),
/// so they live behind their own interface and are only ever called from admin endpoints.
/// </summary>
public interface IAdminAnalyticsRepository
{
    Task<PlatformAnalytics> GetPlatformAnalyticsAsync(CancellationToken cancellationToken = default);

    /// <summary>Per-user activity rollup for the admin user-detail drill-down. Null when the user does not exist.</summary>
    Task<UserActivityDetail?> GetUserDetailAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Page-view rollup over the trailing <paramref name="days"/> window. Separate from
    /// <see cref="GetPlatformAnalyticsAsync"/> because the visits table is the one that grows per
    /// page view rather than per user, and the dashboard lets an admin change the window.
    /// </summary>
    Task<PageVisitAnalytics> GetPageVisitAnalyticsAsync(int days, CancellationToken cancellationToken = default);
}

// ── Result records (kept in Domain so the repository contract is self-contained) ──────────

public record DailyCount(DateTime Date, int Count);

public record UserMetrics(int Total, int Verified, int NewLast7Days, int NewLast30Days);

public record EngagementMetrics(int Dau, int Wau, int Mau, long StudyMinutesLast30Days);

public record ContentMetrics(
    int Documents, int Courses, int Videos, int Quizzes,
    int Flashcards, int Notes, int GlossaryTerms);

public record TopUser(
    Guid UserId, string FullName, string Email,
    long StudyMinutes, DateTime? LastActiveAt);

public record PlatformAnalytics(
    UserMetrics Users,
    EngagementMetrics Engagement,
    ContentMetrics Content,
    IReadOnlyList<DailyCount> SignupTrend,       // daily, last 30 days
    IReadOnlyList<DailyCount> ActiveUsersTrend,  // daily distinct active users, last 14 days
    IReadOnlyList<TopUser> TopUsers);            // top 10 by study minutes, last 30 days

// ── Page visits ───────────────────────────────────────────────────────────────────────────

public record PageVisitTotals(
    long Visits, int UniqueVisitors, long VisitsToday,
    long SignedInVisits, long AnonymousVisits);

public record PagePopularity(string Path, long Visits, int UniqueVisitors);

public record ReferrerCount(string Referrer, long Visits);

public record PageVisitAnalytics(
    PageVisitTotals Totals,
    IReadOnlyList<DailyCount> VisitTrend,        // daily visits across the window
    IReadOnlyList<PagePopularity> TopPages,      // top 12 by visits
    IReadOnlyList<ReferrerCount> TopReferrers);  // top 8 external origins

public record UserContentCounts(
    int Courses, int Documents, int Videos, int Quizzes,
    int Flashcards, int Notes, int GlossaryTerms);

public record UserActivityDetail(
    Guid UserId, string Email, string FullName,
    bool IsAdmin, bool IsActive, bool IsEmailVerified,
    DateTime CreatedAt, DateTime? LastActiveAt,
    UserContentCounts Content,
    long StudyMinutesTotal, long StudyMinutesLast30Days,
    int QuizSubmissions, double? AverageQuizScorePercent,
    IReadOnlyList<DailyCount> StudyTrendMinutes); // daily minutes, last 14 days
