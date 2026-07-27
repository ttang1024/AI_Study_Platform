using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Connections.Features;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;
using StudyPlatform.API.Hubs;
using System.IO.Pipelines;
using Xunit;

namespace StudyPlatform.Tests.Hubs;

/// <summary>
/// The wrapper's job is to keep hub delivery alive when Redis dies mid-flight without
/// double-delivering while it's healthy — both halves are easy to get wrong and impossible to see
/// in a normal test run, so they're pinned here.
/// </summary>
public class ResilientHubLifetimeManagerTests
{
    /// <summary>
    /// <paramref name="degradedWindow"/> defaults to the production 30s cooldown; pass
    /// <see cref="TimeSpan.Zero"/> to make the very next call retry the backplane.
    /// </summary>
    private static ResilientHubLifetimeManager<TestHub> CreateManager(
        RecordingHubLifetimeManager backplane,
        RecordingHubLifetimeManager local,
        TimeSpan? degradedWindow = null)
        => new(backplane, local, NullLogger<ResilientHubLifetimeManager<TestHub>>.Instance, degradedWindow);

    [Fact]
    public async Task SendGroupAsync_WithHealthyBackplane_DoesNotAlsoSendLocally()
    {
        // The Redis backplane loops its own publish back to this process's clients, so sending to
        // both managers would deliver every message twice.
        var backplane = new RecordingHubLifetimeManager();
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.SendGroupAsync("group", "ReceiveMessage", ["hello"]);

        Assert.Equal(["SendGroupAsync:group"], backplane.Calls);
        Assert.Empty(local.Calls);
        Assert.False(manager.IsDegraded);
    }

    [Fact]
    public async Task SendGroupAsync_WhenBackplaneFails_FallsBackToLocalDelivery()
    {
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.SendGroupAsync("group", "ReceiveMessage", ["hello"]);

        Assert.Equal(["SendGroupAsync:group"], backplane.Calls);
        Assert.Equal(["SendGroupAsync:group"], local.Calls);
        Assert.True(manager.IsDegraded);
    }

    [Fact]
    public async Task SendGroupAsync_WhileDegraded_SkipsTheBackplaneEntirely()
    {
        // Retrying a dead Redis on every message would pay a connect timeout per send.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisTimeoutException("timeout", CommandStatus.Unknown) };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.SendGroupAsync("group", "ReceiveMessage", ["first"]);
        await manager.SendAllAsync("ReceiveMessage", ["second"]);

        Assert.Single(backplane.Calls);
        Assert.Equal(["SendGroupAsync:group", "SendAllAsync"], local.Calls);
    }

    [Fact]
    public async Task SendGroupAsync_WithApplicationError_DoesNotFallBackOrDegrade()
    {
        // A serialization bug must surface, not be silently retried against local clients.
        var backplane = new RecordingHubLifetimeManager { Failure = new JsonException("bad payload") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await Assert.ThrowsAsync<JsonException>(() => manager.SendGroupAsync("group", "ReceiveMessage", ["hello"]));

        Assert.Empty(local.Calls);
        Assert.False(manager.IsDegraded);
    }

    [Fact]
    public async Task AddToGroupAsync_AlwaysReachesBothManagers()
    {
        // The local manager can only address a group it has membership for, so topology changes
        // cannot be routed to just one of the two.
        var backplane = new RecordingHubLifetimeManager();
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.AddToGroupAsync("conn-1", "group");
        await manager.RemoveFromGroupAsync("conn-1", "group");

        Assert.Equal(["AddToGroupAsync:group", "RemoveFromGroupAsync:group"], backplane.Calls);
        Assert.Equal(["AddToGroupAsync:group", "RemoveFromGroupAsync:group"], local.Calls);
    }

    [Fact]
    public async Task AddToGroupAsync_WhenBackplaneFails_StillSucceedsLocally()
    {
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.SocketFailure, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.AddToGroupAsync("conn-1", "group");

        Assert.Equal(["AddToGroupAsync:group"], local.Calls);
        Assert.True(manager.IsDegraded);
    }

    [Fact]
    public async Task OnConnectedAsync_WhenBackplaneFails_RegistersLocallyAndSurvives()
    {
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);
        var connection = CreateConnection();

        await manager.OnConnectedAsync(connection);

        Assert.Equal(["OnConnectedAsync"], local.Calls);
        Assert.True(manager.IsDegraded);
        Assert.False(connection.ConnectionAborted.IsCancellationRequested);
    }

    [Fact]
    public async Task OnConnectedAsync_WhileDegraded_DoesNotRetryTheBackplanePerConnection()
    {
        // Otherwise every client connecting during an outage waits out a Redis connect timeout.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.OnConnectedAsync(CreateConnection());
        await manager.OnConnectedAsync(CreateConnection());

        Assert.Single(backplane.Calls);
        Assert.Equal(["OnConnectedAsync", "OnConnectedAsync"], local.Calls);
    }

    [Fact]
    public async Task Recovery_AbortsConnectionsTheBackplaneNeverAccepted()
    {
        // Those connections are invisible to Redis, so once sends route through it again they would
        // receive nothing at all. A forced reconnect re-registers them with both managers.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local, TimeSpan.Zero);

        var duringOutage = CreateConnection();
        await manager.OnConnectedAsync(duringOutage);

        backplane.Failure = null;
        var afterRecovery = CreateConnection();
        await manager.OnConnectedAsync(afterRecovery);

        Assert.False(manager.IsDegraded);
        Assert.False(afterRecovery.ConnectionAborted.IsCancellationRequested);
        await AssertAbortedAsync(duringOutage);
    }

    [Fact]
    public async Task Recovery_LeavesConnectionsAloneWhenTheBackplaneNeverFailed()
    {
        var backplane = new RecordingHubLifetimeManager();
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);
        var connection = CreateConnection();

        await manager.OnConnectedAsync(connection);
        await manager.SendAllAsync("ReceiveMessage", ["hello"]);

        Assert.False(connection.ConnectionAborted.IsCancellationRequested);
    }

    [Fact]
    public async Task OnDisconnectedAsync_SkipsTheBackplaneForConnectionsItNeverAccepted()
    {
        // The Redis manager's teardown requires per-connection state its OnConnectedAsync never got
        // to set, and throwing here terminates the client's transport with an error.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local, TimeSpan.Zero);
        var connection = CreateConnection();

        await manager.OnConnectedAsync(connection);
        backplane.Failure = new InvalidOperationException("Feature 'IRedisFeature' is not present.");
        await manager.OnDisconnectedAsync(connection);

        Assert.Equal(["OnConnectedAsync"], backplane.Calls);
        Assert.Equal(["OnConnectedAsync", "OnDisconnectedAsync"], local.Calls);
    }

    [Fact]
    public async Task AddToGroupAsync_SkipsTheBackplaneForConnectionsItNeverAccepted()
    {
        // The backplane would treat it as another replica's connection and wait out an ack that no
        // replica can send — for a connection that is about to be aborted anyway.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local, TimeSpan.Zero);
        var connection = CreateConnection();

        await manager.OnConnectedAsync(connection);
        backplane.Failure = null;
        await manager.AddToGroupAsync(connection.ConnectionId, "group");

        Assert.Equal(["OnConnectedAsync"], backplane.Calls);
        Assert.Equal(["OnConnectedAsync", "AddToGroupAsync:group"], local.Calls);
    }

    [Fact]
    public async Task OnDisconnectedAsync_SwallowsBackplaneFailures()
    {
        // The connection is gone either way; throwing here just logs a spurious error per client.
        var backplane = new RecordingHubLifetimeManager { Failure = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down") };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);
        var connection = CreateConnection();

        await manager.OnDisconnectedAsync(connection);

        Assert.Equal(["OnDisconnectedAsync"], local.Calls);
    }

    [Fact]
    public async Task WrappedRedisTimeout_IsTreatedAsABackplaneFailure()
    {
        // Redis failures surface wrapped in whatever the manager was awaiting.
        var backplane = new RecordingHubLifetimeManager
        {
            Failure = new InvalidOperationException("publish failed", new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down")),
        };
        var local = new RecordingHubLifetimeManager();
        var manager = CreateManager(backplane, local);

        await manager.SendAllAsync("ReceiveMessage", ["hello"]);

        Assert.Equal(["SendAllAsync"], local.Calls);
    }

    private static HubConnectionContext CreateConnection()
        => new(new TestConnectionContext(), new HubConnectionContextOptions(), NullLoggerFactory.Instance);

    /// <summary>HubConnectionContext.Abort() cancels off the thread pool, so poll rather than race it.</summary>
    private static async Task AssertAbortedAsync(HubConnectionContext connection)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!connection.ConnectionAborted.IsCancellationRequested && DateTime.UtcNow < deadline)
            await Task.Delay(10);

        Assert.True(connection.ConnectionAborted.IsCancellationRequested);
    }

    public class TestHub : Hub;

    /// <summary>Records what it was asked to do, and optionally fails the way Redis would.</summary>
    private sealed class RecordingHubLifetimeManager : HubLifetimeManager<TestHub>
    {
        public List<string> Calls { get; } = [];

        public Exception? Failure { get; set; }

        private Task Record(string call)
        {
            Calls.Add(call);
            return Failure is null ? Task.CompletedTask : Task.FromException(Failure);
        }

        public override Task OnConnectedAsync(HubConnectionContext connection) => Record("OnConnectedAsync");

        public override Task OnDisconnectedAsync(HubConnectionContext connection) => Record("OnDisconnectedAsync");

        public override Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
            => Record($"AddToGroupAsync:{groupName}");

        public override Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
            => Record($"RemoveFromGroupAsync:{groupName}");

        public override Task SendAllAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record("SendAllAsync");

        public override Task SendAllExceptAsync(string methodName, object?[] args, IReadOnlyList<string> excludedConnectionIds, CancellationToken cancellationToken = default)
            => Record("SendAllExceptAsync");

        public override Task SendConnectionAsync(string connectionId, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record($"SendConnectionAsync:{connectionId}");

        public override Task SendConnectionsAsync(IReadOnlyList<string> connectionIds, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record("SendConnectionsAsync");

        public override Task SendGroupAsync(string groupName, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record($"SendGroupAsync:{groupName}");

        public override Task SendGroupsAsync(IReadOnlyList<string> groupNames, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record("SendGroupsAsync");

        public override Task SendGroupExceptAsync(string groupName, string methodName, object?[] args, IReadOnlyList<string> excludedConnectionIds, CancellationToken cancellationToken = default)
            => Record($"SendGroupExceptAsync:{groupName}");

        public override Task SendUserAsync(string userId, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record($"SendUserAsync:{userId}");

        public override Task SendUsersAsync(IReadOnlyList<string> userIds, string methodName, object?[] args, CancellationToken cancellationToken = default)
            => Record("SendUsersAsync");
    }

    /// <summary>Minimal transport-less connection: enough for HubConnectionContext to be built and aborted.</summary>
    private sealed class TestConnectionContext : ConnectionContext
    {
        private readonly Pipe _application = new();
        private readonly Pipe _transport = new();
        private readonly CancellationTokenSource _aborted = new();

        public TestConnectionContext()
        {
            Transport = new DuplexPipe(_application.Reader, _transport.Writer);
            Features.Set<IConnectionLifetimeFeature>(new LifetimeFeature(_aborted));
        }

        public override string ConnectionId { get; set; } = Guid.NewGuid().ToString();

        public override IFeatureCollection Features { get; } = new FeatureCollection();

        public override IDictionary<object, object?> Items { get; set; } = new Dictionary<object, object?>();

        public override IDuplexPipe Transport { get; set; }

        public override CancellationToken ConnectionClosed
        {
            get => _aborted.Token;
            set { }
        }

        public override void Abort() => _aborted.Cancel();

        private sealed class LifetimeFeature(CancellationTokenSource aborted) : IConnectionLifetimeFeature
        {
            public CancellationToken ConnectionClosed { get => aborted.Token; set { } }

            public void Abort() => aborted.Cancel();
        }

        private sealed class DuplexPipe(PipeReader reader, PipeWriter writer) : IDuplexPipe
        {
            public PipeReader Input { get; } = reader;

            public PipeWriter Output { get; } = writer;
        }
    }
}
