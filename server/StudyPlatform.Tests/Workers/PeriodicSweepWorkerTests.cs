using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using StudyPlatform.API.Services;
using Xunit;

namespace StudyPlatform.Tests.Workers;

/// <summary>
/// The loop every polling worker inherits. The guarantee under test is that a worker cannot die:
/// an exception escaping ExecuteAsync would silently stop the sweep for the life of the process.
/// </summary>
public class PeriodicSweepWorkerTests
{
    /// <summary>A worker whose sweep is scripted by the test.</summary>
    private sealed class TestWorker(Func<int, Task> sweep, TimeSpan? interval = null, bool start = true)
        : PeriodicSweepWorker(NullLogger.Instance)
    {
        public int Sweeps;
        public bool Started;

        protected override TimeSpan SweepInterval => interval ?? TimeSpan.FromMilliseconds(5);
        protected override string SweepName => "Test";
        protected override LogLevel SweepFailureLevel => LogLevel.Warning;

        protected override Task<bool> OnStartingAsync(CancellationToken cancellationToken)
        {
            Started = true;
            return Task.FromResult(start);
        }

        protected override Task SweepAsync(CancellationToken cancellationToken)
            => sweep(Interlocked.Increment(ref Sweeps));

        public Task RunAsync(CancellationToken token) => StartAsync(token);
    }

    private static async Task<TestWorker> RunUntilAsync(
        Func<TestWorker, bool> done, Func<int, Task> sweep, bool start = true)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var worker = new TestWorker(sweep, start: start);
        await worker.RunAsync(cts.Token);

        while (!done(worker) && !cts.IsCancellationRequested)
            await Task.Delay(5, CancellationToken.None);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);
        return worker;
    }

    [Fact]
    public async Task ExecuteAsync_SweepsRepeatedlyOnTheInterval()
    {
        var worker = await RunUntilAsync(w => w.Sweeps >= 3, _ => Task.CompletedTask);

        Assert.True(worker.Sweeps >= 3);
    }

    [Fact]
    public async Task ExecuteAsync_AThrowingSweepDoesNotStopTheWorker()
    {
        // A transient database blip must not take the worker out for the life of the process.
        var worker = await RunUntilAsync(
            w => w.Sweeps >= 3,
            n => n <= 2 ? Task.FromException(new InvalidOperationException("boom")) : Task.CompletedTask);

        Assert.True(worker.Sweeps >= 3);
    }

    [Fact]
    public async Task ExecuteAsync_OnStartingReturningFalse_SkipsTheLoopEntirely()
    {
        var worker = await RunUntilAsync(w => w.Started, _ => Task.CompletedTask, start: false);

        Assert.True(worker.Started);
        Assert.Equal(0, worker.Sweeps);
    }

    [Fact]
    public async Task StopAsync_UnwindsPromptlyWhileWaitingBetweenSweeps()
    {
        using var cts = new CancellationTokenSource();
        var worker = new TestWorker(_ => Task.CompletedTask, interval: TimeSpan.FromHours(1));
        await worker.RunAsync(cts.Token);

        while (worker.Sweeps == 0)
            await Task.Delay(5, CancellationToken.None);

        // Shutdown must not wait out the interval.
        var stop = worker.StopAsync(CancellationToken.None);
        var finished = await Task.WhenAny(stop, Task.Delay(TimeSpan.FromSeconds(5)));

        Assert.Same(stop, finished);
        await stop;
    }

    [Fact]
    public async Task ExecuteAsync_ACancelledSweepDuringShutdownIsNotTreatedAsAFailure()
    {
        using var cts = new CancellationTokenSource();
        var worker = new TestWorker(_ => Task.Delay(TimeSpan.FromHours(1), cts.Token));
        await worker.RunAsync(cts.Token);

        while (worker.Sweeps == 0)
            await Task.Delay(5, CancellationToken.None);

        await cts.CancelAsync();

        // StopAsync surfaces whatever ExecuteAsync threw; the loop swallows the cancellation itself.
        await worker.StopAsync(CancellationToken.None);
    }
}
