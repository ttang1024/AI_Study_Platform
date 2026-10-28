using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Builds queued data exports.
///
/// <para>Polls rather than taking work through an in-memory channel: an export needs no per-caller
/// credentials, so any replica can run any request. Polling makes the work replica-agnostic, which in
/// turn means a request stranded by a restart is picked up by whoever is next round.</para>
///
/// <para>The claim is a conditional update — <c>Pending → Running</c> only if still <c>Pending</c> —
/// so two replicas polling the same row cannot both build it. The loser's update matches zero rows
/// and it moves on.</para>
/// </summary>
public sealed class DataExportWorker : PeriodicSweepWorker
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
        : base(logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override TimeSpan SweepInterval => PollInterval;

    protected override string SweepName => "Data export";

    // A poll that loses its claim race or catches a restart is ordinary; it is not an error.
    protected override LogLevel SweepFailureLevel => LogLevel.Warning;

    protected override async Task SweepAsync(CancellationToken cancellationToken)
    {
        await ReclaimStaleAsync(cancellationToken);
        await ProcessNextAsync(cancellationToken);
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

        var blobStorage = scope.ServiceProvider.GetRequiredService<IBlobStorageService>();
        string? uploadedBlobUrl = null;
        try
        {
            var builder = scope.ServiceProvider.GetRequiredService<IDataExportBuilder>();

            await using var archive = await builder.BuildAsync(next.UserId, cancellationToken);
            var size = archive.Length;

            var blobUrl = await blobStorage.UploadAsync(
                archive,
                $"exports/{next.UserId}/study-platform-export-{startedAt:yyyyMMdd-HHmmss}.zip",
                "application/zip",
                cancellationToken);
            uploadedBlobUrl = blobUrl;

            // Computed here, not inside the lambda: ExecuteUpdate translates its value expressions to SQL,
            // and DateTime.UtcNow.Add(<a TimeSpan field>) has no translation — that threw on every export,
            // after the upload, and left each one Failed.
            var completedAt = DateTime.UtcNow;
            var expiresAt = completedAt.Add(DownloadWindow);
            await db.DataExportRequests
                .Where(r => r.DataExportRequestId == next.DataExportRequestId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, DataExportStatus.Completed)
                    .SetProperty(r => r.BlobUrl, blobUrl)
                    .SetProperty(r => r.SizeBytes, size)
                    .SetProperty(r => r.CompletedAt, completedAt)
                    .SetProperty(r => r.ExpiresAt, expiresAt),
                    cancellationToken);

            _logger.LogInformation(
                "Built data export {ExportId} for user {UserId} ({Bytes} bytes)",
                next.DataExportRequestId, next.UserId, size);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down (a deploy), not a failed export: hand it back so the next process builds it,
            // instead of telling the user it failed.
            await DeleteOrphanAsync(blobStorage, uploadedBlobUrl, next.DataExportRequestId);
            await db.DataExportRequests
                .Where(r => r.DataExportRequestId == next.DataExportRequestId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, DataExportStatus.Pending)
                    .SetProperty(r => r.StartedAt, (DateTime?)null),
                    CancellationToken.None);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Data export {ExportId} failed", next.DataExportRequestId);

            // Uploaded but never recorded: nothing would ever point at (or delete) this full copy of the
            // user's data.
            await DeleteOrphanAsync(blobStorage, uploadedBlobUrl, next.DataExportRequestId);

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

    private async Task DeleteOrphanAsync(IBlobStorageService blobStorage, string? blobUrl, Guid exportId)
    {
        if (blobUrl == null) return;
        try
        {
            await blobStorage.DeleteAsync(blobUrl, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete the orphaned archive of export {ExportId}", exportId);
        }
    }
}
