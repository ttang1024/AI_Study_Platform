using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.HealthChecks;
using StudyPlatform.API.Hubs;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Startup;

/// <summary>
/// Redis is optional and off by default. These cover the three states a deployment can be in —
/// disabled, asked-for-but-absent, and enabled — with the emphasis on the first two: the API must come
/// up and serve with no Redis anywhere, which is exactly the AWS ECS Fargate + Supabase shape.
/// </summary>
public class RedisServiceExtensionsTests
{
    private static IConfiguration Configuration(params (string Key, string Value)[] settings)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))
            .Build();

    /// <summary>A port nothing is listening on, so "Redis is configured but absent" is reproducible.</summary>
    private const string UnreachableRedis = "127.0.0.1:6399";

    // ---------------------------------------------------------------- Redis disabled

    [Fact]
    public void ResolveRedisConnection_WithNoRedisConfigurationAtAll_IsDisabled()
    {
        // The literal default: nothing in configuration mentions Redis.
        var redis = RedisServiceExtensions.ResolveRedisConnection(Configuration());

        Assert.False(redis.Enabled);
        Assert.False(redis.IsUsable);
        Assert.Null(redis.Configuration);
        Assert.Equal(RedisConnectionSettings.DisabledByConfigurationReason, redis.DisabledReason);
    }

    [Fact]
    public void AddApplicationCache_WhenDisabled_UsesTheNoOpCacheAndNeverRegistersRedis()
    {
        var configuration = Configuration(("Redis:Enabled", "false"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        services.AddApplicationCache(configuration, redis);

        // No Redis type of any kind reaches the container: no cache implementation out of the
        // StackExchange.Redis packages, no IConnectionMultiplexer.
        Assert.DoesNotContain(services, d => d.ServiceType == typeof(IConnectionMultiplexer));
        Assert.DoesNotContain(services, d =>
            d.ImplementationType?.Namespace?.Contains("StackExchangeRedis", StringComparison.Ordinal) == true);

        using var provider = services.BuildServiceProvider();
        Assert.IsType<NoOpDistributedCache>(provider.GetRequiredService<IDistributedCache>());
        Assert.False(provider.GetRequiredService<CacheBackend>().UsesRedis);
    }

    [Fact]
    public void AddApplicationSignalR_WhenDisabled_LeavesTheInMemoryLifetimeManagerInPlace()
    {
        var configuration = Configuration(("Redis:Enabled", "false"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        var reason = services.AddApplicationSignalR(configuration, redis);

        Assert.Equal(RedisConnectionSettings.DisabledByConfigurationReason, reason);
        Assert.DoesNotContain(services, d => d.ImplementationType == typeof(RedisResilientHubLifetimeManager<>));
    }

    [Fact]
    public async Task CacheHealthCheck_WhenRedisIsDisabled_IsHealthy()
    {
        // The readiness probe must not report a deployment that never wanted Redis as degraded.
        var check = new CacheHealthCheck(
            new NoOpDistributedCache(),
            new CacheBackend(UsesRedis: false, Description: "Postgres cache tier"));

        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    // ------------------------------------------- Redis disabled, but a Redis server does not exist

    [Fact]
    public void WhenDisabled_AConfiguredButAbsentRedisIsStillNotTouched()
    {
        // Someone left a stale connection string behind and the server is gone. Redis:Enabled=false
        // wins: the string is never parsed, never dialled, and startup is unaffected.
        var configuration = Configuration(
            ("Redis:Enabled", "false"),
            ("Redis:ConnectionString", UnreachableRedis));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        Assert.False(redis.IsUsable);
        Assert.Null(redis.Configuration);

        services.AddApplicationCache(configuration, redis);
        var reason = services.AddApplicationSignalR(configuration, redis);

        Assert.Equal(RedisConnectionSettings.DisabledByConfigurationReason, reason);

        using var provider = services.BuildServiceProvider();
        Assert.IsType<NoOpDistributedCache>(provider.GetRequiredService<IDistributedCache>());
    }

    [Fact]
    public void WhenEnabledButTheConnectionStringIsMissing_TheAppStillWiresUpACache()
    {
        // Degrade, don't fail: a half-configured Redis must not stop the process from starting.
        var configuration = Configuration(("Redis:Enabled", "true"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        Assert.True(redis.Enabled);
        Assert.False(redis.IsUsable);
        Assert.Contains("no Redis connection string", redis.DisabledReason);

        services.AddApplicationCache(configuration, redis);
        using var provider = services.BuildServiceProvider();
        Assert.IsType<NoOpDistributedCache>(provider.GetRequiredService<IDistributedCache>());
    }

    [Fact]
    public void WhenEnabledButTheConnectionStringIsUnparseable_TheAppStillWiresUpACache()
    {
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("Redis:ConnectionString", ":"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        Assert.False(redis.IsUsable);

        services.AddApplicationCache(configuration, redis);
        using var provider = services.BuildServiceProvider();
        Assert.IsType<NoOpDistributedCache>(provider.GetRequiredService<IDistributedCache>());
    }

    [Fact]
    public void WhenEnabledButTheServerIsAbsent_TheBackplaneIsSkippedRatherThanFailingStartup()
    {
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("Redis:ConnectionString", UnreachableRedis),
            ("Redis:ConnectTimeoutMilliseconds", "200"),
            ("Redis:SyncTimeoutMilliseconds", "200"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        var reason = services.AddApplicationSignalR(configuration, redis);

        Assert.NotNull(reason);
        Assert.Contains("unreachable", reason);
        // A RedisHubLifetimeManager pointed at a dead server fails every hub send, so it must not be
        // registered at all.
        Assert.DoesNotContain(services, d => d.ImplementationType == typeof(RedisResilientHubLifetimeManager<>));
    }

    // ---------------------------------------------------------------- Redis enabled

    [Fact]
    public void ResolveRedisConnection_WhenEnabledWithAValidConnectionString_IsUsable()
    {
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("Redis:ConnectionString", "cache.example.com:6380,ssl=true"),
            ("Redis:ConnectTimeoutMilliseconds", "2500"));

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);

        Assert.True(redis.IsUsable);
        Assert.Null(redis.DisabledReason);
        Assert.Single(redis.Configuration!.EndPoints);
        Assert.True(redis.Configuration.Ssl);
        Assert.Equal(2500, redis.Configuration.ConnectTimeout);
        // Never abort startup on a connect failure — the cache degrades instead.
        Assert.False(redis.Configuration.AbortOnConnectFail);
    }

    [Fact]
    public void ResolveRedisConnection_PrefersTheConnectionStringsSection()
    {
        // ConnectionStrings:Redis wins over Redis:ConnectionString, as it did before.
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("ConnectionStrings:Redis", "from-connection-strings:6379"),
            ("Redis:ConnectionString", "from-redis-section:6379"));

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);

        Assert.Contains("from-connection-strings", redis.Configuration!.EndPoints[0].ToString());
    }

    [Fact]
    public void AddApplicationCache_WhenEnabled_RegistersTheRedisCacheWithTheConfiguredInstanceName()
    {
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("Redis:ConnectionString", "cache.example.com:6379"),
            ("Redis:InstanceName", "StudyPlatform:test:"));
        var services = new ServiceCollection();
        services.AddLogging();

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        services.AddApplicationCache(configuration, redis);

        using var provider = services.BuildServiceProvider();
        // The package ships a RedisCache subclass, so this is an assignability check, not an exact type.
        Assert.IsAssignableFrom<RedisCache>(provider.GetRequiredService<IDistributedCache>());
        Assert.True(provider.GetRequiredService<CacheBackend>().UsesRedis);

        var options = provider.GetRequiredService<IOptions<RedisCacheOptions>>().Value;
        Assert.Equal("StudyPlatform:test:", options.InstanceName);
        Assert.Same(redis.Configuration, options.ConfigurationOptions);
    }

    [Fact]
    public async Task WhenEnabledAgainstALiveRedis_TheCacheRoundTrips()
    {
        // Integration-flavoured: exercised only when a Redis is actually listening (docker compose up
        // -d redis). Without one there is nothing to assert about Redis behaviour, and the suite must
        // stay runnable with no external services — which is the whole point of this change.
        var configuration = Configuration(
            ("Redis:Enabled", "true"),
            ("Redis:ConnectionString", "localhost:6379"),
            ("Redis:ConnectTimeoutMilliseconds", "500"),
            ("Redis:SyncTimeoutMilliseconds", "500"),
            ("Redis:InstanceName", "StudyPlatform:test:"));

        var redis = RedisServiceExtensions.ResolveRedisConnection(configuration);
        Assert.True(redis.IsUsable);

        if (!RedisServiceExtensions.TryConnect(redis.Configuration!, out _))
            return;

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationCache(configuration, redis);

        using var provider = services.BuildServiceProvider();
        var cache = provider.GetRequiredService<IDistributedCache>();

        var key = $"redis-round-trip:{Guid.NewGuid():N}";
        await cache.SetStringAsync(key, "value", new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
        });

        Assert.Equal("value", await cache.GetStringAsync(key));

        var check = new CacheHealthCheck(cache, provider.GetRequiredService<CacheBackend>());
        Assert.Equal(HealthStatus.Healthy, (await check.CheckHealthAsync(new HealthCheckContext())).Status);

        await cache.RemoveAsync(key);
    }
}
