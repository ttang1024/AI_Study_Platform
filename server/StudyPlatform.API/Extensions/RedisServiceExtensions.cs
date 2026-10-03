using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.StackExchangeRedis;
using Microsoft.Extensions.Caching.Distributed;
using StackExchange.Redis;
using StudyPlatform.API.Hubs;
using StudyPlatform.Infrastructure.Services;

namespace StudyPlatform.API.Extensions;

/// <summary>
/// How this process talks to Redis, resolved once at startup. <see cref="Configuration"/> is non-null
/// only when <c>Redis:Enabled</c> is true <em>and</em> a usable connection string was supplied, so
/// every consumer keys off <see cref="IsUsable"/> rather than re-reading configuration and
/// re-deciding.
/// </summary>
/// <param name="Enabled">Whether <c>Redis:Enabled</c> asked for Redis at all.</param>
/// <param name="Configuration">Parsed connection options, or null when Redis will not be used.</param>
/// <param name="DisabledReason">Why Redis will not be used; null when it will be.</param>
public sealed record RedisConnectionSettings(
    bool Enabled,
    ConfigurationOptions? Configuration,
    string? DisabledReason)
{
    public const string DisabledByConfigurationReason = "Redis:Enabled is false";

    public static readonly RedisConnectionSettings Disabled =
        new(Enabled: false, Configuration: null, DisabledReason: DisabledByConfigurationReason);

    /// <summary>True when Redis is both wanted and configured well enough to connect to.</summary>
    public bool IsUsable => Enabled && Configuration is not null;
}

/// <summary>
/// Which distributed-cache backend the process ended up with. Registered as a singleton purely so
/// <c>CacheHealthCheck</c> can tell "Redis is down" (worth reporting) from "Redis was never asked
/// for" (nothing to report).
/// </summary>
public sealed record CacheBackend(bool UsesRedis, string Description);

/// <summary>
/// Startup wiring for every Redis-backed service: the distributed cache and the SignalR backplane.
///
/// Redis is optional and off by default. Nothing here touches StackExchange.Redis — no
/// <see cref="ConnectionMultiplexer"/>, no connection string lookup beyond configuration, no socket —
/// unless <c>Redis:Enabled=true</c>. A deployment that never sets it (AWS ECS Fargate against
/// Supabase, say) starts, serves, and reports healthy with no Redis anywhere.
/// </summary>
public static class RedisServiceExtensions
{
    private const string DefaultInstanceName = "StudyPlatform:";

    /// <summary>
    /// Reads <c>Redis:*</c> and decides, once, whether Redis is in play. Parsing failures are
    /// downgrades, not exceptions: a malformed connection string leaves the app on the Postgres cache
    /// tier rather than refusing to boot.
    /// </summary>
    public static RedisConnectionSettings ResolveRedisConnection(IConfiguration configuration)
    {
        if (!configuration.GetValue("Redis:Enabled", false))
            return RedisConnectionSettings.Disabled;

        var connectionString = configuration.GetConnectionString("Redis")
            ?? configuration["Redis:ConnectionString"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return new RedisConnectionSettings(
                Enabled: true,
                Configuration: null,
                DisabledReason: "Redis:Enabled is true but no Redis connection string is configured");
        }

        if (!TryParseConfiguration(connectionString, out var options, out var parseError))
        {
            return new RedisConnectionSettings(
                Enabled: true,
                Configuration: null,
                DisabledReason: $"the Redis connection string is unusable: {parseError}");
        }

        ApplyTimeouts(options!, configuration);
        return new RedisConnectionSettings(Enabled: true, Configuration: options, DisabledReason: null);
    }

    /// <summary>
    /// Registers the distributed cache: Redis when it is usable, otherwise
    /// <see cref="NoOpDistributedCache"/> so <c>IAppCache</c> serves from the Postgres cache tier.
    /// </summary>
    public static IServiceCollection AddApplicationCache(
        this IServiceCollection services,
        IConfiguration configuration,
        RedisConnectionSettings redis)
    {
        if (redis.IsUsable)
        {
            services.AddStackExchangeRedisCache(options =>
            {
                options.ConfigurationOptions = redis.Configuration;
                options.InstanceName = GetInstanceName(configuration);
            });
            services.AddSingleton(new CacheBackend(UsesRedis: true, Description: "Redis"));
            return services;
        }

        // Only worth a line on stderr when someone asked for Redis and did not get it. Silence when
        // Redis:Enabled is false — that is the default and intended production state.
        if (redis.Enabled)
            Console.Error.WriteLine($"Redis cache disabled: {redis.DisabledReason}.");

        services.AddSingleton<IDistributedCache, NoOpDistributedCache>();
        services.AddSingleton(new CacheBackend(
            UsesRedis: false,
            Description: $"Postgres cache tier ({redis.DisabledReason})"));
        return services;
    }

    /// <summary>
    /// Registers SignalR and, when Redis is usable <em>and answering</em>, the Redis backplane behind
    /// <see cref="RedisResilientHubLifetimeManager{THub}"/>.
    ///
    /// The reachability probe matters because — unlike the cache tier — the backplane has no fallback
    /// of its own: a <see cref="RedisHubLifetimeManager{THub}"/> pointed at a dead server fails every
    /// hub connect and broadcast. Probing keeps a developer who has not started Redis, or an install
    /// whose Redis is down at boot, on the in-memory lifetime manager, which serves a single replica
    /// perfectly well.
    /// </summary>
    /// <returns>Why the backplane is not active, or null when it is.</returns>
    public static string? AddApplicationSignalR(
        this IServiceCollection services,
        IConfiguration configuration,
        RedisConnectionSettings redis)
    {
        var signalR = services.AddSignalR();

        if (!redis.IsUsable)
            return redis.DisabledReason ?? "Redis is not configured";

        if (!TryConnect(redis.Configuration!, out var probeError))
            return $"Redis is unreachable: {probeError}";

        signalR.AddStackExchangeRedis(options =>
        {
            // Cloned so the ChannelPrefix below doesn't leak into the cache's copy of the same options.
            options.Configuration = redis.Configuration!.Clone();
            // Namespaced so several environments can share one Redis without cross-talking.
            options.Configuration.ChannelPrefix = RedisChannel.Literal(GetInstanceName(configuration));
        });

        // …and wrap it so an outage *after* startup degrades to instance-local delivery instead of
        // failing every send. Registered last, so it wins over the manager AddStackExchangeRedis just
        // registered — which it now owns as its backplane. The probe above matters here too: it
        // guarantees the Redis manager's one-time channel subscriptions happen against a live server.
        services.AddSingleton(typeof(RedisHubLifetimeManager<>));
        services.AddSingleton(typeof(DefaultHubLifetimeManager<>));
        services.AddSingleton(typeof(HubLifetimeManager<>), typeof(RedisResilientHubLifetimeManager<>));
        return null;
    }

    private static string GetInstanceName(IConfiguration configuration)
        => configuration["Redis:InstanceName"] ?? DefaultInstanceName;

    internal static bool TryParseConfiguration(
        string? connectionString,
        out ConfigurationOptions? configuration,
        out string? error)
    {
        configuration = null;
        error = null;

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            error = "no Redis connection string was configured.";
            return false;
        }

        try
        {
            configuration = ConfigurationOptions.Parse(connectionString);
            configuration.AbortOnConnectFail = false;

            if (configuration.EndPoints.Count == 0)
            {
                error = "no Redis endpoints were configured.";
                configuration = null;
                return false;
            }

            foreach (var endpoint in configuration.EndPoints)
            {
                if (endpoint is System.Net.DnsEndPoint dnsEndpoint
                    && string.IsNullOrWhiteSpace(dnsEndpoint.Host.Trim(':')))
                {
                    error = $"invalid Redis endpoint '{dnsEndpoint.Host}:{dnsEndpoint.Port}'.";
                    configuration = null;
                    return false;
                }
            }

            return true;
        }
        catch (Exception ex) when (ex is ArgumentException or FormatException)
        {
            error = ex.Message;
            configuration = null;
            return false;
        }
    }

    // Best-effort reachability check. Bounded by ConnectTimeout/SyncTimeout (1s each by default), so a
    // down Redis costs a couple of seconds of startup, not a hang.
    internal static bool TryConnect(ConfigurationOptions configuration, out string? error)
    {
        error = null;

        var probeConfiguration = configuration.Clone();
        probeConfiguration.AbortOnConnectFail = false;
        probeConfiguration.ConnectRetry = 1;
        probeConfiguration.ClientName = "StudyPlatform.BackplaneProbe";

        try
        {
            using var probe = ConnectionMultiplexer.Connect(probeConfiguration);
            if (!probe.IsConnected)
            {
                error = $"no endpoint answered within {probeConfiguration.ConnectTimeout} ms";
                return false;
            }

            probe.GetDatabase().Ping();
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    internal static void ApplyTimeouts(ConfigurationOptions configuration, IConfiguration appConfiguration)
    {
        configuration.ConnectTimeout = GetMilliseconds(appConfiguration, "Redis:ConnectTimeoutMilliseconds", 1000);
        configuration.AsyncTimeout = GetMilliseconds(appConfiguration, "Redis:AsyncTimeoutMilliseconds", 1000);
        configuration.SyncTimeout = GetMilliseconds(appConfiguration, "Redis:SyncTimeoutMilliseconds", 1000);
    }

    private static int GetMilliseconds(IConfiguration configuration, string key, int defaultMilliseconds)
        => int.TryParse(configuration[key], out var milliseconds) && milliseconds > 0
            ? milliseconds
            : defaultMilliseconds;
}
