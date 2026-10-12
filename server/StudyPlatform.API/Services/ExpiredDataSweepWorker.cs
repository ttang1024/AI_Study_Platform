using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Deletes rows that are past their expiry and can never be used again: the Postgres cache tier,
/// stored transcript segments, OTP codes, refresh tokens, and page visits older than the retention
/// window.
///
/// <para>Each of these is only checked for expiry when it is read — an entry nobody asks for again
/// (a one-off video's transcript, an AI result for a deleted document, the token of a device that never
/// came back) used to stay forever, and the cache table in particular grows with every AI call. With
/// Redis off in production, CacheEntries is the cache, so its size is query cost on every lookup.</para>
///
/// <para>PageVisits is the only table that grows with traffic rather than with what users create, and
/// its rows are anonymous-writable. The dashboard never looks past
/// <c>Analytics:PageVisitRetentionDays</c> (default 180), so anything older is dead weight.</para>
/// </summary>
public sealed class ExpiredDataSweepWorker : PeriodicSweepWorker
{
    private static readonly TimeSpan SweepEvery = TimeSpan.FromHours(1);

    /// <summary>Expired auth rows are kept briefly so reuse detection and support questions still have them.</summary>
    private static readonly TimeSpan AuthRowGrace = TimeSpan.FromDays(1);

    private const int DefaultPageVisitRetentionDays = 180;

    private const int BatchSize = 5_000;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredDataSweepWorker> _logger;
    private readonly int _pageVisitRetentionDays;

    public ExpiredDataSweepWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<ExpiredDataSweepWorker> logger)
        : base(logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _pageVisitRetentionDays = Math.Max(1, configuration.GetValue("Analytics:PageVisitRetentionDays", DefaultPageVisitRetentionDays));
    }

    protected override TimeSpan SweepInterval => SweepEvery;

    protected override string SweepName => "Expired data sweep";

    // Harmless to miss one: the next sweep deletes the same rows, and readers already ignore them.
    protected override LogLevel SweepFailureLevel => LogLevel.Warning;

    protected override async Task SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var authCutoff = now - AuthRowGrace;
        var pageVisitCutoff = now.AddDays(-_pageVisitRetentionDays);

        var cache = await DeleteInBatchesAsync(db.CacheEntries, e => e.ExpiresAt <= now, e => e.ExpiresAt, cancellationToken);
        var transcripts = await DeleteInBatchesAsync(db.VideoTranscriptEntries, e => e.ExpiresAt <= now, e => e.ExpiresAt, cancellationToken);
        var otps = await DeleteInBatchesAsync(db.OtpCodes, o => o.ExpiresAt <= authCutoff, o => o.ExpiresAt, cancellationToken);
        var tokens = await DeleteInBatchesAsync(db.RefreshTokens, t => t.ExpiresAt <= authCutoff, t => t.ExpiresAt, cancellationToken);
        var visits = await DeleteInBatchesAsync(db.PageVisits, v => v.OccurredAt < pageVisitCutoff, v => v.OccurredAt, cancellationToken);

        if (cache + transcripts + otps + tokens + visits > 0)
            _logger.LogInformation(
                "Deleted expired rows: {Cache} cache, {Transcripts} transcript, {Otps} OTP, {Tokens} refresh token, {Visits} page visit.",
                cache, transcripts, otps, tokens, visits);
    }

    /// <summary>Batched so one sweep never holds a long transaction over a large table.</summary>
    private static async Task<int> DeleteInBatchesAsync<T, TKey>(
        DbSet<T> set,
        Expression<Func<T, bool>> expired,
        Expression<Func<T, TKey>> order,
        CancellationToken cancellationToken) where T : class
    {
        var total = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            var deleted = await set.Where(expired).OrderBy(order).Take(BatchSize).ExecuteDeleteAsync(cancellationToken);
            total += deleted;
            if (deleted < BatchSize)
                break;
        }
        return total;
    }
}
