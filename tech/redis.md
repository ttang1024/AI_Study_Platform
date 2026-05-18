# Redis And Cache

## Runtime Behavior

The API uses Redis only when `Redis:Enabled` is `true` and either `ConnectionStrings:Redis` or `Redis:ConnectionString` is configured. Redis is disabled by default. Disabled, invalid, or missing Redis configuration falls back to `IDistributedCache` in memory so normal API requests do not fail because Redis is unavailable.

Rate limiting is intentionally process-local with `AddInMemoryRateLimiting()`. Redis outages do not break rate-limit checks.

### Startup wiring (Program.cs)

```csharp
// Program.cs — Redis or in-memory fallback
var redisEnabled = builder.Configuration.GetValue("Redis:Enabled", false);
var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
    ?? builder.Configuration["Redis:ConnectionString"];

if (redisEnabled)
{
    if (TryGetRedisConfiguration(redisConnectionString, out var redisConfig, out var error))
    {
        ConfigureRedisTimeouts(redisConfig!, builder.Configuration);
        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.ConfigurationOptions = redisConfig;
            options.InstanceName = builder.Configuration["Redis:InstanceName"] ?? "StudyPlatform:";
        });
    }
    else
    {
        if (!string.IsNullOrWhiteSpace(redisConnectionString))
            Console.Error.WriteLine($"Redis cache disabled: {error}");

        builder.Services.AddDistributedMemoryCache();
    }
}
else
{
    builder.Services.AddDistributedMemoryCache();   // silent in-process fallback
}

// Rate limiting always uses in-memory; Redis outage must not produce 500s.
builder.Services.AddInMemoryRateLimiting();
```

`TryGetRedisConfiguration` parses the connection string with `ConfigurationOptions.Parse`, sets `AbortOnConnectFail = false`, and returns `false` (disabling Redis) if the string is empty, malformed, or contains no valid endpoints.

```csharp
// Program.cs — timeout overrides applied to the parsed ConfigurationOptions
static void ConfigureRedisTimeouts(ConfigurationOptions cfg, IConfiguration appCfg)
{
    cfg.ConnectTimeout = GetConfiguredMilliseconds(appCfg, "Redis:ConnectTimeoutMilliseconds", 1000);
    cfg.AsyncTimeout   = GetConfiguredMilliseconds(appCfg, "Redis:AsyncTimeoutMilliseconds",   1000);
    cfg.SyncTimeout    = GetConfiguredMilliseconds(appCfg, "Redis:SyncTimeoutMilliseconds",    1000);
}
```

## Services

| File | Role |
| --- | --- |
| `Program.cs` | Parses Redis configuration and wires cache fallback |
| `DistributedAppCache.cs` | `IAppCache` wrapper over `IDistributedCache` |
| `CacheOptions.cs` | Cache duration settings |

## DistributedAppCache

`DistributedAppCache` is the single `IAppCache` implementation registered as a **singleton**. Every cache operation goes through a two-tier stack: Redis (or in-memory fallback) as the primary tier and a PostgreSQL `CacheEntries` table as a persistent secondary tier.

### GetOrCreateAsync

The public entry point used by `AiService` and analytics:

```csharp
// DistributedAppCache.cs
public async Task<T> GetOrCreateAsync<T>(
    string key,
    Func<CancellationToken, Task<T>> factory,
    TimeSpan absoluteExpirationRelativeToNow,
    CancellationToken cancellationToken = default)
{
    var cached = await GetAsync<T>(key, cancellationToken);
    if (cached is not null)
        return cached;

    var value = await factory(cancellationToken);
    await SetAsync(key, value, absoluteExpirationRelativeToNow, cancellationToken);
    return value;
}
```

### GetAsync — Redis → PostgreSQL fallback chain

```csharp
// DistributedAppCache.cs — read path
public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
{
    if (ShouldSkipRedis())                          // 30-s circuit breaker active
        return await GetFromPersistentCacheAsync<T>(key, cancellationToken, backfillRedis: false);

    try
    {
        using var cacheTimeout = CreateCacheTimeout(cancellationToken);
        var bytes = await _cache.GetAsync(key, cacheTimeout?.Token ?? cancellationToken);

        if (bytes is null || bytes.Length == 0)
            return await GetFromPersistentCacheAsync<T>(key, cancellationToken); // Redis miss → try PG

        await BackfillPersistentCacheFromRedisAsync(key, bytes, cancellationToken);
        return JsonSerializer.Deserialize<T>(bytes, SerializerOptions);
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        MarkRedisUnavailable();                     // timeout → open circuit breaker
        return await GetFromPersistentCacheAsync<T>(key, cancellationToken);
    }
    catch (Exception ex)
    {
        MarkRedisUnavailable();                     // any error → open circuit breaker
        return await GetFromPersistentCacheAsync<T>(key, cancellationToken);
    }
}
```

### SetAsync — write to PostgreSQL then Redis

```csharp
// DistributedAppCache.cs — write path
public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
{
    var bytes    = JsonSerializer.SerializeToUtf8Bytes(value, SerializerOptions);
    var expiresAt = DateTime.UtcNow.Add(ttl);

    if (!await SetPersistentCacheAsync(key, bytes, expiresAt, ct))
        return;                                     // PG write failed; skip Redis too

    if (ShouldSkipRedis()) return;

    using var cacheTimeout = CreateCacheTimeout(ct);
    await _cache.SetAsync(key, bytes,
        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
        cacheTimeout?.Token ?? ct);
}
```

### PostgreSQL persistent cache (upsert)

`SetPersistentCacheAsync` uses a PostgreSQL `INSERT … ON CONFLICT DO UPDATE` to atomically upsert cache entries:

```csharp
// DistributedAppCache.cs — PostgreSQL upsert
await db.Database.ExecuteSqlInterpolatedAsync($"""
    INSERT INTO "CacheEntries" ("Key", "Value", "ExpiresAt", "CreatedAt", "UpdatedAt")
    VALUES ({key}, {bytes}, {expiresAt}, {now}, {now})
    ON CONFLICT ("Key") DO UPDATE
    SET "Value"     = EXCLUDED."Value",
        "ExpiresAt" = EXCLUDED."ExpiresAt",
        "UpdatedAt" = EXCLUDED."UpdatedAt";
    """, cancellationToken);
```

Redis-hit backfill uses the same upsert but only updates rows that have already expired, so a fresher Redis value never overwrites a still-valid PG entry:

```csharp
ON CONFLICT ("Key") DO UPDATE … WHERE "CacheEntries"."ExpiresAt" <= {now}
```

### Circuit breaker

Redis errors open a 30-second circuit breaker, routing all subsequent reads and writes to the PostgreSQL fallback:

```csharp
private bool ShouldSkipRedis()   => DateTime.UtcNow < _redisUnavailableUntil;
private void MarkRedisUnavailable() => _redisUnavailableUntil = DateTime.UtcNow.AddSeconds(30);

// Per-operation timeout wraps the caller's CancellationToken
private CancellationTokenSource? CreateCacheTimeout(CancellationToken ct)
{
    if (_cacheOptions.OperationTimeoutMilliseconds <= 0) return null;
    var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
    cts.CancelAfter(TimeSpan.FromMilliseconds(_cacheOptions.OperationTimeoutMilliseconds));
    return cts;
}
```

### TTL derivation for Redis-hit backfill

When a Redis hit is backfilled into PostgreSQL, the TTL is derived from the cache key prefix rather than the original expiry (which is not stored in Redis):

```csharp
// DistributedAppCache.cs — GetFallbackExpirationForRedisHit
private TimeSpan GetFallbackExpirationForRedisHit(string key)
{
    if (key.StartsWith("transcript:", StringComparison.Ordinal)
        || key.StartsWith("transcript_segments:", StringComparison.Ordinal)
        || key.StartsWith("subtitles:", StringComparison.Ordinal))
        return TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

    if (key.StartsWith("analytics:", StringComparison.Ordinal))
        return TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds);

    if (key.StartsWith("documents:sas:", StringComparison.Ordinal))
        return TimeSpan.FromSeconds(_cacheOptions.SasUrlSeconds);

    return TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
}
```

## Main Cache Uses

- AI generation result caching in `AiService` (key: `ai:{provider}:{model}:{category}:{inputHash}`)
- Analytics summary caching (key prefix: `analytics:`)
- YouTube transcript, subtitle, and segment cache in `YouTubeController` (key prefix: `transcript:`, `subtitles:`, `transcript_segments:`)

## CacheOptions defaults

```csharp
// CacheOptions.cs — defaults (overridable via appsettings "Cache" section)
public int GeneratedResultSeconds    { get; set; } = 2592000;  // 30 days
public int TranscriptSeconds         { get; set; } = 2592000;  // 30 days
public int SasUrlSeconds             { get; set; } = 3000;     // ~50 min
public int AnalyticsSummarySeconds   { get; set; } = 30;
public int DashboardStatsSeconds     { get; set; } = 60;
public int OperationTimeoutMilliseconds { get; set; } = 500;   // per-op Redis timeout
```

## Configuration

| Key | Meaning |
| --- | --- |
| `Redis:Enabled` | Enables Redis cache when `true`; default `false` |
| `Redis:ConnectionString` or `ConnectionStrings:Redis` | Redis endpoint |
| `Redis:InstanceName` | cache key prefix, default `StudyPlatform:` |
| `Redis:ConnectTimeoutMilliseconds` | connection timeout (default 1000) |
| `Redis:AsyncTimeoutMilliseconds` | async op timeout (default 1000) |
| `Redis:SyncTimeoutMilliseconds` | sync op timeout (default 1000) |
| `Cache:AiGenerationSeconds` | generated AI result TTL |
| `Cache:AnalyticsSummarySeconds` | analytics summary TTL |
| `Cache:TranscriptSeconds` | YouTube transcript/subtitle TTL |
| `Cache:SasUrlSeconds` | blob SAS URL TTL |
| `Cache:OperationTimeoutMilliseconds` | per-operation Redis timeout before circuit opens |
