using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.AspNetCore.SignalR.StackExchangeRedis;
using StackExchange.Redis;

namespace StudyPlatform.API.Hubs;

/// <summary>
/// Keeps real-time messaging working when the Redis backplane dies <em>after</em> startup.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="RedisHubLifetimeManager{THub}"/> has no fallback of its own: <c>SendGroupAsync</c> and
/// <c>SendAllAsync</c> always publish to Redis — even for clients connected to this very process —
/// so an outage stops delivery entirely rather than merely stopping cross-replica delivery. This
/// wrapper adds the missing tier, mirroring the "degrade, don't fail" rule the cache layer follows
/// (<see cref="StudyPlatform.Infrastructure.Services.DistributedAppCache"/> falls back to Postgres).
/// </para>
/// <para>
/// How it stays consistent: <b>every</b> connection and group change is applied to both managers, so
/// each one independently knows the local topology. Only the <i>send</i> path picks a single manager
/// — the backplane while healthy, the local manager while degraded — so a healthy backplane never
/// double-delivers (its own subscription loops back to this process's clients).
/// </para>
/// <para>
/// Group state stays correct across an outage because the Redis manager short-circuits group
/// add/remove for connections it already owns, without touching Redis at all.
/// </para>
/// <para>
/// The one thing this cannot paper over: a connection that arrives <i>during</i> an outage fails to
/// register with the backplane (<c>OnConnectedAsync</c> throws before the connection is stored), so
/// once Redis returns it would be invisible to sends routed through Redis — silently receiving
/// nothing. Those connections are aborted on recovery; every client builds its hub with
/// <c>withAutomaticReconnect()</c> and re-joins its groups on reconnect, so the cost is a reconnect
/// blip instead of a dead session.
/// </para>
/// </remarks>
public class ResilientHubLifetimeManager<THub> : HubLifetimeManager<THub> where THub : Hub
{
    /// <summary>How long to stay on the local manager after a backplane failure before retrying it.</summary>
    private static readonly TimeSpan DefaultDegradedWindow = TimeSpan.FromSeconds(30);

    private readonly HubLifetimeManager<THub> _backplane;
    private readonly HubLifetimeManager<THub> _local;
    private readonly ILogger _logger;
    private readonly TimeSpan _degradedWindow;

    /// <summary>
    /// Connections the backplane never accepted; aborted once it recovers. Entries live until the
    /// connection actually goes away — the Redis manager sets per-connection state in
    /// <c>OnConnectedAsync</c> that its <c>OnDisconnectedAsync</c> then requires, so it must be kept
    /// out of both ends of the lifecycle, not just the first.
    /// </summary>
    private readonly ConcurrentDictionary<string, HubConnectionContext> _unregistered = new();

    /// <summary>UTC ticks until which the backplane is presumed down; 0 means healthy.</summary>
    private long _degradedUntilTicks;

    public ResilientHubLifetimeManager(
        HubLifetimeManager<THub> backplane,
        HubLifetimeManager<THub> local,
        ILogger<ResilientHubLifetimeManager<THub>> logger,
        TimeSpan? degradedWindow = null)
    {
        _backplane = backplane;
        _local = local;
        _logger = logger;
        _degradedWindow = degradedWindow ?? DefaultDegradedWindow;
    }

    /// <summary>True while the backplane is being bypassed. Exposed for diagnostics and tests.</summary>
    public bool IsDegraded
    {
        get
        {
            var degradedUntil = Interlocked.Read(ref _degradedUntilTicks);
            return degradedUntil != 0 && DateTime.UtcNow.Ticks < degradedUntil;
        }
    }

    public override async Task OnConnectedAsync(HubConnectionContext connection)
    {
        // The local manager can only deliver to connections it knows about, so it always gets one.
        await _local.OnConnectedAsync(connection);

        // Registering against a backplane already known to be down would stall every new client on
        // a connect timeout, and the outcome is the same: unregistered until recovery.
        if (!ShouldTryBackplane())
        {
            _unregistered[connection.ConnectionId] = connection;
            return;
        }

        try
        {
            await _backplane.OnConnectedAsync(connection);
            _unregistered.TryRemove(connection.ConnectionId, out _);
            // A completed registration is proof Redis is answering again.
            MarkHealthy();
        }
        catch (Exception ex) when (IsBackplaneFailure(ex))
        {
            // Not registered upstream: other replicas can't see it, and neither will this one once
            // sends route back through Redis. Remembered so recovery can force a clean reconnect.
            _unregistered[connection.ConnectionId] = connection;
            MarkDegraded(ex, nameof(OnConnectedAsync));
        }
    }

    public override async Task OnDisconnectedAsync(HubConnectionContext connection)
    {
        var neverRegistered = _unregistered.TryRemove(connection.ConnectionId, out _);

        await _local.OnDisconnectedAsync(connection);

        // Tearing down a connection the backplane never registered throws on its missing
        // per-connection state, which would kill the transport with an error on the way out.
        if (neverRegistered)
            return;

        try
        {
            await _backplane.OnDisconnectedAsync(connection);
        }
        catch (Exception ex) when (IsBackplaneFailure(ex))
        {
            // Nothing to retry — the connection is gone either way, and a stale Redis subscription
            // is harmless. Never let teardown throw, or the hub logs a spurious error per client.
            MarkDegraded(ex, nameof(OnDisconnectedAsync));
        }
    }

    // Group membership is written to both managers so either can address the group on its own. For
    // connections owned by this process the Redis manager keeps this purely in memory, so these
    // stay correct throughout an outage; for connections on another replica it needs Redis, and
    // that acknowledgement is simply lost while Redis is down.
    public override Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        => ApplyToBothAsync(connectionId, m => m.AddToGroupAsync(connectionId, groupName, cancellationToken), nameof(AddToGroupAsync));

    public override Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        => ApplyToBothAsync(connectionId, m => m.RemoveFromGroupAsync(connectionId, groupName, cancellationToken), nameof(RemoveFromGroupAsync));

    public override Task SendAllAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendAllAsync(methodName, args, cancellationToken), nameof(SendAllAsync));

    public override Task SendAllExceptAsync(string methodName, object?[] args, IReadOnlyList<string> excludedConnectionIds, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendAllExceptAsync(methodName, args, excludedConnectionIds, cancellationToken), nameof(SendAllExceptAsync));

    public override Task SendConnectionAsync(string connectionId, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendConnectionAsync(connectionId, methodName, args, cancellationToken), nameof(SendConnectionAsync));

    public override Task SendConnectionsAsync(IReadOnlyList<string> connectionIds, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendConnectionsAsync(connectionIds, methodName, args, cancellationToken), nameof(SendConnectionsAsync));

    public override Task SendGroupAsync(string groupName, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendGroupAsync(groupName, methodName, args, cancellationToken), nameof(SendGroupAsync));

    public override Task SendGroupsAsync(IReadOnlyList<string> groupNames, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendGroupsAsync(groupNames, methodName, args, cancellationToken), nameof(SendGroupsAsync));

    public override Task SendGroupExceptAsync(string groupName, string methodName, object?[] args, IReadOnlyList<string> excludedConnectionIds, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendGroupExceptAsync(groupName, methodName, args, excludedConnectionIds, cancellationToken), nameof(SendGroupExceptAsync));

    public override Task SendUserAsync(string userId, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendUserAsync(userId, methodName, args, cancellationToken), nameof(SendUserAsync));

    public override Task SendUsersAsync(IReadOnlyList<string> userIds, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.SendUsersAsync(userIds, methodName, args, cancellationToken), nameof(SendUsersAsync));

    // Client results (Clients.Client(id).InvokeAsync<T>): the invocation and its completion have to
    // be tracked by the same manager, so both legs follow the same healthy/degraded choice.
    public override Task<T> InvokeConnectionAsync<T>(string connectionId, string methodName, object?[] args, CancellationToken cancellationToken = default)
        => SendAsync(m => m.InvokeConnectionAsync<T>(connectionId, methodName, args, cancellationToken), nameof(InvokeConnectionAsync));

    public override Task SetConnectionResultAsync(string connectionId, CompletionMessage result)
        => SendAsync(m => m.SetConnectionResultAsync(connectionId, result), nameof(SetConnectionResultAsync));

    /// <summary>Purely a local lookup in both managers, so it never needs the degraded/healthy split.</summary>
    public override bool TryGetReturnType(string invocationId, [NotNullWhen(true)] out Type? type)
        => _backplane.TryGetReturnType(invocationId, out type) || _local.TryGetReturnType(invocationId, out type);

    /// <summary>Runs on exactly one manager: the backplane loops back to local clients by itself.</summary>
    private async Task SendAsync(Func<HubLifetimeManager<THub>, Task> operation, string operationName)
    {
        if (ShouldTryBackplane())
        {
            try
            {
                await operation(_backplane);
                MarkHealthy();
                return;
            }
            catch (Exception ex) when (IsBackplaneFailure(ex))
            {
                MarkDegraded(ex, operationName);
            }
        }

        await operation(_local);
    }

    private async Task<T> SendAsync<T>(Func<HubLifetimeManager<THub>, Task<T>> operation, string operationName)
    {
        if (ShouldTryBackplane())
        {
            try
            {
                var result = await operation(_backplane);
                MarkHealthy();
                return result;
            }
            catch (Exception ex) when (IsBackplaneFailure(ex))
            {
                MarkDegraded(ex, operationName);
            }
        }

        return await operation(_local);
    }

    /// <summary>Topology changes go to both managers so either can serve a send on its own.</summary>
    private async Task ApplyToBothAsync(string connectionId, Func<HubLifetimeManager<THub>, Task> operation, string operationName)
    {
        await operation(_local);

        // The backplane doesn't know this connection, so it would treat the change as one belonging
        // to another replica and block until the acknowledgement times out — for a connection that
        // is about to be aborted anyway.
        if (_unregistered.ContainsKey(connectionId))
            return;

        try
        {
            await operation(_backplane);
            MarkHealthy();
        }
        catch (Exception ex) when (IsBackplaneFailure(ex))
        {
            MarkDegraded(ex, operationName);
        }
    }

    private bool ShouldTryBackplane()
    {
        var degradedUntil = Interlocked.Read(ref _degradedUntilTicks);
        return degradedUntil == 0 || DateTime.UtcNow.Ticks >= degradedUntil;
    }

    private void MarkDegraded(Exception exception, string operation)
    {
        var degradedUntil = DateTime.UtcNow.Add(_degradedWindow).Ticks;
        var previous = Interlocked.Exchange(ref _degradedUntilTicks, degradedUntil);

        // Only the healthy → degraded transition logs, so an outage costs one warning, not one per
        // message. Retries that fail again land here with a non-zero previous value.
        if (previous == 0)
        {
            _logger.LogWarning(
                exception,
                "SignalR Redis backplane failed during {Operation}; delivering hub messages to this instance's "
                + "clients only and retrying Redis in {DegradedSeconds}s",
                operation,
                _degradedWindow.TotalSeconds);
        }
    }

    private void MarkHealthy()
    {
        if (Interlocked.Read(ref _degradedUntilTicks) == 0)
            return;

        // Whoever flips it back owns the recovery work; concurrent callers see 0 and move on.
        if (Interlocked.Exchange(ref _degradedUntilTicks, 0) == 0)
            return;

        var abandoned = 0;
        foreach (var connection in _unregistered.Values)
        {
            // Invisible to the backplane, so it would receive nothing now that sends route through
            // Redis again. Aborting makes the client reconnect and register with both managers.
            // The entry stays until it disconnects, so teardown still skips the backplane.
            if (connection.ConnectionAborted.IsCancellationRequested)
                continue;

            connection.Abort();
            abandoned++;
        }

        _logger.LogInformation(
            "SignalR Redis backplane recovered; aborted {AbortedConnections} connection(s) that joined during the "
            + "outage so their clients reconnect and re-register",
            abandoned);
    }

    /// <summary>
    /// Distinguishes "Redis is unreachable" from a genuine bug (a serialization error, a bad
    /// argument), which must keep throwing rather than be quietly retried against local clients.
    /// </summary>
    private static bool IsBackplaneFailure(Exception exception) => exception switch
    {
        RedisException or SocketException or TimeoutException or IOException => true,
        AggregateException aggregate => aggregate.InnerExceptions.Any(IsBackplaneFailure),
        _ => exception.InnerException is { } inner && IsBackplaneFailure(inner),
    };
}

/// <summary>
/// DI shim: the open-generic registration needs constructor parameters DI can tell apart, while
/// <see cref="ResilientHubLifetimeManager{THub}"/> takes two managers of the same base type so tests
/// can supply fakes.
/// </summary>
public sealed class RedisResilientHubLifetimeManager<THub> : ResilientHubLifetimeManager<THub> where THub : Hub
{
    public RedisResilientHubLifetimeManager(
        RedisHubLifetimeManager<THub> backplane,
        DefaultHubLifetimeManager<THub> local,
        ILogger<ResilientHubLifetimeManager<THub>> logger)
        : base(backplane, local, logger)
    {
    }
}
