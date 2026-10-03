using Microsoft.EntityFrameworkCore;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Deletes page-view rows older than the retention window.
///
/// <para>This is the only table in the schema that grows with traffic rather than with what users
/// create, and its rows are anonymous-writable, so without a sweep it grows without bound and a
/// year-old visit costs storage forever to answer a question nobody asks. The dashboard never looks
/// past <c>Analytics:PageVisitRetentionDays</c> (default 180), so anything older is dead weight.</para>
/// </summary>
public sealed class PageVisitRetentionWorker : PeriodicSweepWorker
{
    private static readonly TimeSpan SweepEvery = TimeSpan.FromHours(12);

    private const int DefaultRetentionDays = 180;

    /// <summary>Deleted in batches so one sweep cannot hold a long transaction over a huge table.</summary>
    private const int BatchSize = 10_000;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PageVisitRetentionWorker> _logger;
    private readonly int _retentionDays;

    public PageVisitRetentionWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<PageVisitRetentionWorker> logger)
        : base(logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _retentionDays = Math.Max(1, configuration.GetValue("Analytics:PageVisitRetentionDays", DefaultRetentionDays));
    }

    protected override TimeSpan SweepInterval => SweepEvery;

    protected override string SweepName => "Page visit retention";

    // A missed sweep is harmless — the next one twelve hours later deletes the same rows.
    protected override LogLevel SweepFailureLevel => LogLevel.Warning;

    protected override async Task SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-_retentionDays);
        var deletedTotal = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var deleted = await db.PageVisits
                .Where(v => v.OccurredAt < cutoff)
                .OrderBy(v => v.OccurredAt)
                .Take(BatchSize)
                .ExecuteDeleteAsync(cancellationToken);

            deletedTotal += deleted;
            if (deleted < BatchSize)
                break;
        }

        if (deletedTotal > 0)
            _logger.LogInformation(
                "Deleted {Count} page visit(s) older than {Days} days.", deletedTotal, _retentionDays);
    }
}
