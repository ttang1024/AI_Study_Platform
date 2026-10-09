using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class SingleFlightTests
{
    [Fact]
    public async Task ConcurrentCallsForSameKey_ShareOneExecution()
    {
        var flight = new SingleFlight<string, int>();
        var gate = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var runs = 0;
        Task<int> Work() { Interlocked.Increment(ref runs); return gate.Task; }

        var first = flight.RunAsync("v1", Work, CancellationToken.None);
        var second = flight.RunAsync("v1", Work, CancellationToken.None);
        gate.SetResult(42);

        var results = await Task.WhenAll(first, second);
        Assert.Equal(new[] { 42, 42 }, results);
        Assert.Equal(1, runs);
    }

    [Fact]
    public async Task DifferentKeys_RunIndependently()
    {
        var flight = new SingleFlight<string, string>();

        var a = flight.RunAsync("a", () => Task.FromResult("A"), CancellationToken.None);
        var b = flight.RunAsync("b", () => Task.FromResult("B"), CancellationToken.None);

        var results = await Task.WhenAll(a, b);
        Assert.Equal(new[] { "A", "B" }, results);
    }

    [Fact]
    public async Task FinishedCall_IsNotReused()
    {
        var flight = new SingleFlight<string, int>();
        var runs = 0;
        Task<int> Work() => Task.FromResult(Interlocked.Increment(ref runs));

        Assert.Equal(1, await flight.RunAsync("v1", Work, CancellationToken.None));
        Assert.Equal(2, await flight.RunAsync("v1", Work, CancellationToken.None));
    }

    [Fact]
    public async Task Failure_ReachesEveryWaiter_AndNextCallRetries()
    {
        var flight = new SingleFlight<string, int>();
        var gate = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        var first = flight.RunAsync("v1", () => gate.Task, CancellationToken.None);
        var second = flight.RunAsync("v1", () => gate.Task, CancellationToken.None);
        gate.SetException(new InvalidOperationException("blocked"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => first);
        await Assert.ThrowsAsync<InvalidOperationException>(() => second);
        Assert.Equal(7, await flight.RunAsync("v1", () => Task.FromResult(7), CancellationToken.None));
    }

    [Fact]
    public async Task OneCallerCancelling_DoesNotCancelTheSharedCall()
    {
        var flight = new SingleFlight<string, int>();
        var gate = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        using var leaving = new CancellationTokenSource();

        var quitter = flight.RunAsync("v1", () => gate.Task, leaving.Token);
        var stayer = flight.RunAsync("v1", () => gate.Task, CancellationToken.None);
        leaving.Cancel();
        gate.SetResult(5);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => quitter);
        Assert.Equal(5, await stayer);
    }
}
