using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Builds queued data exports.
///
/// <para>Polls rather than taking work through an in-memory channel, and that is the difference
/// between this and <c>AiJobQueue</c>: an export needs no per-caller credentials, so any replica can
/// run any request. Polling makes the work replica-agnostic, which in turn means a request stranded
/// by a restart is picked up by whoever is next round rather than needing a reaper.</para>
///
/// <para>The claim is a conditional update — <c>Pending → Running</c> only if still <c>Pending</c> —
/// so two replicas polling the same row cannot both build it. The loser's update matches zero rows
/// and it moves on.</para>
/// </summary>
public sealed class DataExportWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(20);

    /// <summary>
    /// How long a finished archive stays downloadable. Short because the file is a complete copy of
    /// one person's data; long enough to survive the user not checking their machine for a day.
    /// </summary>
    private static readonly TimeSpan DownloadWindow = TimeSpan.FromDays(3);

    /// <summary>
    /// A request still marked Running long past any plausible build is one whose replica died
    /// mid-export. Returned to Pending so somebody picks it up, rather than leaving the user
    /// watching a status that will never change.
    /// </summary>
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DataExportWorker> _logger;

    public DataExportWorker(IServiceScopeFactory scopeFactory, ILogger<DataExportWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReclaimStaleAsync(stoppingToken);
                await ProcessNextAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Data export sweep failed; will retry.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReclaimStaleAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - StaleAfter;
        await db.DataExportRequests
            .Where(r => r.Status == DataExportStatus.Running && r.StartedAt < cutoff)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, DataExportStatus.Pending)
                .SetProperty(r => r.StartedAt, (DateTime?)null),
                cancellationToken);
    }

    private async Task ProcessNextAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var next = await db.DataExportRequests
            .AsNoTracking()
            .Where(r => r.Status == DataExportStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (next == null)
            return;

        var startedAt = DateTime.UtcNow;
        var claimed = await db.DataExportRequests
            .Where(r => r.DataExportRequestId == next.DataExportRequestId
                        && r.Status == DataExportStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, DataExportStatus.Running)
                .SetProperty(r => r.StartedAt, startedAt),
                cancellationToken);

        // Another replica got there first.
        if (claimed == 0)
            return;

        try
        {
            var builder = scope.ServiceProvider.GetRequiredService<IDataExportBuilder>();
            var blobStorage = scope.ServiceProvider.GetRequiredService<IBlobStorageService>();

            await using var archive = await builder.BuildAsync(next.UserId, cancellationToken);
            var size = archive.Length;

            var blobUrl = await blobStorage.UploadAsync(
                archive,
                $"exports/{next.UserId}/study-platform-export-{startedAt:yyyyMMdd-HHmmss}.zip",
                "application/zip",
                cancellationToken);

            await db.DataExportRequests
                .Where(r => r.DataExportRequestId == next.DataExportRequestId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, DataExportStatus.Completed)
                    .SetProperty(r => r.BlobUrl, blobUrl)
                    .SetProperty(r => r.SizeBytes, size)
                    .SetProperty(r => r.CompletedAt, DateTime.UtcNow)
                    .SetProperty(r => r.ExpiresAt, DateTime.UtcNow.Add(DownloadWindow)),
                    cancellationToken);

            _logger.LogInformation(
                "Built data export {ExportId} for user {UserId} ({Bytes} bytes)",
                next.DataExportRequestId, next.UserId, size);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Data export {ExportId} failed", next.DataExportRequestId);

            // Recorded on the row rather than only in logs: the user is watching this status, and a
            // request that silently stops moving is indistinguishable from one still in progress.
            await db.DataExportRequests
                .Where(r => r.DataExportRequestId == next.DataExportRequestId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, DataExportStatus.Failed)
                    .SetProperty(r => r.CompletedAt, DateTime.UtcNow)
                    .SetProperty(r => r.ErrorMessage, "The export could not be built. Please try again."),
                    CancellationToken.None);
        }
    }
}
