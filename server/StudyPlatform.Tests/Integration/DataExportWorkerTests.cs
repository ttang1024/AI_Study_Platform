using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// The export worker's state machine against the real table: the claim that keeps two pollers from
/// building one export, reclaiming a row a dead process left Running, and what a failure or a shutdown
/// mid-build leaves behind for the user watching the status.
/// </summary>
[Collection(PostgresCollection.Name)]
public class DataExportWorkerTests
{
    private readonly PostgresFixture _db;

    public DataExportWorkerTests(PostgresFixture db) => _db = db;

    private sealed class FakeBuilder(Func<CancellationToken, Task<Stream>> build) : IDataExportBuilder
    {
        public int Calls;
        public Task<Stream> BuildAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref Calls);
            return build(cancellationToken);
        }
    }

    private sealed class FakeBlobs : IBlobStorageService
    {
        public readonly List<string> Uploaded = [];
        public readonly List<string> Deleted = [];
        public Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default)
        {
            lock (Uploaded) Uploaded.Add(fileName);
            return Task.FromResult($"blob://{fileName}");
        }
        public Task DeleteAsync(string blobUrl, CancellationToken cancellationToken = default)
        {
            lock (Deleted) Deleted.Add(blobUrl);
            return Task.CompletedTask;
        }
        public Task<Stream> DownloadAsync(string blobUrl, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<string> GetSasUrlAsync(string blobUrl, int expiryMinutes = 60, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<string> GetMediaUrlAsync(string blobUrl, string contentType, int expiryMinutes = 60, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private DataExportWorker Worker(IDataExportBuilder builder, IBlobStorageService blobs)
    {
        var services = new ServiceCollection()
            .AddDbContext<AppDbContext>(o => o.UseNpgsql(_db.ConnectionString, x => x.UseVector()))
            .AddSingleton(builder)
            .AddSingleton(blobs)
            .BuildServiceProvider();
        return new DataExportWorker(services.GetRequiredService<IServiceScopeFactory>(), NullLogger<DataExportWorker>.Instance);
    }

    private static Func<CancellationToken, Task<Stream>> Archive => _ => Task.FromResult<Stream>(new MemoryStream([1, 2, 3]));

    /// <summary>A user with one export in <paramref name="status"/>; every other export is cleared so the worker's
    /// oldest-first pick is this one.</summary>
    private async Task<Guid> ExportAsync(string status = DataExportStatus.Pending, DateTime? startedAt = null)
    {
        var now = DateTime.UtcNow;
        var userId = Guid.NewGuid();
        var exportId = Guid.NewGuid();
        await using var seed = _db.NewContext();
        await seed.DataExportRequests.ExecuteDeleteAsync();
        seed.Users.Add(new User { UserId = userId, Email = $"{userId:N}@example.com", FullName = "E", PasswordHash = "x", CreatedAt = now, UpdatedAt = now });
        seed.DataExportRequests.Add(new DataExportRequest { DataExportRequestId = exportId, UserId = userId, Status = status, StartedAt = startedAt, CreatedAt = now });
        await seed.SaveChangesAsync();
        return exportId;
    }

    private async Task<DataExportRequest> RowAsync(Guid id)
    {
        await using var context = _db.NewContext();
        return await context.DataExportRequests.AsNoTracking().SingleAsync(r => r.DataExportRequestId == id);
    }

    /// <summary>Runs the workers' first sweep until <paramref name="done"/> holds (or 10 s), then stops them.</summary>
    private async Task RunUntilAsync(Func<Task<bool>> done, params DataExportWorker[] workers)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await Task.WhenAll(workers.Select(w => w.StartAsync(CancellationToken.None)));
        while (!deadline.IsCancellationRequested && !await done())
            await Task.Delay(50);
        await Task.WhenAll(workers.Select(w => w.StopAsync(CancellationToken.None)));
    }

    [DockerFact]
    public async Task PendingExport_IsBuiltUploadedAndMadeDownloadable()
    {
        var id = await ExportAsync();
        var blobs = new FakeBlobs();

        await RunUntilAsync(async () => (await RowAsync(id)).Status == DataExportStatus.Completed, Worker(new FakeBuilder(Archive), blobs));

        var row = await RowAsync(id);
        Assert.Equal(DataExportStatus.Completed, row.Status);
        Assert.Equal(3, row.SizeBytes);
        Assert.StartsWith("blob://exports/", row.BlobUrl);
        Assert.InRange(row.ExpiresAt!.Value, DateTime.UtcNow.AddDays(2.9), DateTime.UtcNow.AddDays(3.1));
    }

    [DockerFact]
    public async Task TwoWorkersPollingTogether_BuildTheExportOnce()
    {
        // The claim is a conditional Pending -> Running update: the loser matches no row and moves on.
        var id = await ExportAsync();
        var builder = new FakeBuilder(async ct => { await Task.Delay(200, ct); return new MemoryStream([1]); });
        var blobs = new FakeBlobs();

        await RunUntilAsync(async () => (await RowAsync(id)).Status == DataExportStatus.Completed,
            Worker(builder, blobs), Worker(builder, blobs), Worker(builder, blobs));

        Assert.Equal(DataExportStatus.Completed, (await RowAsync(id)).Status);

        Assert.Equal(1, builder.Calls);
        Assert.Single(blobs.Uploaded);
    }

    [DockerFact]
    public async Task ExportLeftRunningByADeadProcess_IsReclaimedAndBuilt()
    {
        var id = await ExportAsync(DataExportStatus.Running, startedAt: DateTime.UtcNow.AddMinutes(-31));

        await RunUntilAsync(async () => (await RowAsync(id)).Status == DataExportStatus.Completed, Worker(new FakeBuilder(Archive), new FakeBlobs()));

        Assert.Equal(DataExportStatus.Completed, (await RowAsync(id)).Status);
    }

    [DockerFact]
    public async Task ExportRunningRecently_IsNotStolen()
    {
        // Another process is building it right now; reclaiming that would build it twice.
        var id = await ExportAsync(DataExportStatus.Running, startedAt: DateTime.UtcNow.AddMinutes(-1));
        var builder = new FakeBuilder(Archive);

        var worker = Worker(builder, new FakeBlobs());
        await worker.StartAsync(CancellationToken.None);
        await Task.Delay(500); // long enough for the first sweep, far short of the 30-minute reclaim
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(DataExportStatus.Running, (await RowAsync(id)).Status);
        Assert.Equal(0, builder.Calls);
    }

    [DockerFact]
    public async Task BuildFailure_IsRecordedOnTheRow_ForTheUserWatchingIt()
    {
        var id = await ExportAsync();
        var blobs = new FakeBlobs();

        await RunUntilAsync(async () => (await RowAsync(id)).Status == DataExportStatus.Failed,
            Worker(new FakeBuilder(_ => throw new InvalidOperationException("db timeout reading notes")), blobs));

        var row = await RowAsync(id);
        Assert.Equal(DataExportStatus.Failed, row.Status);
        Assert.Equal("The export could not be built. Please try again.", row.ErrorMessage); // no internals
        Assert.Empty(blobs.Uploaded);
    }

    [DockerFact]
    public async Task ShutdownMidBuild_HandsTheExportBack_InsteadOfFailingIt()
    {
        // A deploy is not a failed export: the next process should build it.
        var id = await ExportAsync();
        var building = new TaskCompletionSource();
        var builder = new FakeBuilder(async ct =>
        {
            building.TrySetResult();
            await Task.Delay(Timeout.Infinite, ct);
            return Stream.Null;
        });
        var worker = Worker(builder, new FakeBlobs());

        await worker.StartAsync(CancellationToken.None);
        await building.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await worker.StopAsync(CancellationToken.None);

        var row = await RowAsync(id);
        Assert.Equal(DataExportStatus.Pending, row.Status);
        Assert.Null(row.StartedAt);
    }
}
