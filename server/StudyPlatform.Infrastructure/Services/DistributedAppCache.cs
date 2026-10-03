using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

public class DistributedAppCache : IAppCache
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly IDistributedCache _cache;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DistributedAppCache> _logger;
    private readonly CacheOptions _cacheOptions;
    private DateTime _redisUnavailableUntil = DateTime.MinValue;

    public DistributedAppCache(
        IDistributedCache cache,
        IServiceScopeFactory scopeFactory,
        ILogger<DistributedAppCache> logger,
        IOptions<CacheOptions> cacheOptions)
    {
        _cache = cache;
        _scopeFactory = scopeFactory;
        _logger = logger;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (ShouldSkipRedis())
            return await GetFromPersistentCacheAsync<T>(key, cancellationToken, backfillRedis: false);

        try
        {
            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            var bytes = await _cache.GetAsync(key, cacheTimeout?.Token ?? cancellationToken);
            if (bytes is null || bytes.Length == 0)
                return await GetFromPersistentCacheAsync<T>(key, cancellationToken);

            await BackfillPersistentCacheFromRedisAsync(key, bytes, cancellationToken);
            return JsonSerializer.Deserialize<T>(bytes, SerializerOptions);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(
                "Cache read timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
            return await GetFromPersistentCacheAsync<T>(key, cancellationToken);
        }
        catch (Exception ex)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(ex, "Cache read failed for key {CacheKey}", key);
            return await GetFromPersistentCacheAsync<T>(key, cancellationToken);
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan absoluteExpirationRelativeToNow, CancellationToken cancellationToken = default)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, SerializerOptions);
            var expiresAt = DateTime.UtcNow.Add(absoluteExpirationRelativeToNow);
            if (!await SetPersistentCacheAsync(key, bytes, expiresAt, cancellationToken))
                return;

            if (ShouldSkipRedis())
                return;

            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = absoluteExpirationRelativeToNow
            }, cacheTimeout?.Token ?? cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(
                "Cache write timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
        }
        catch (Exception ex)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(ex, "Cache write failed for key {CacheKey}", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        await RemovePersistentCacheAsync(key, cancellationToken);

        if (ShouldSkipRedis())
            return;

        try
        {
            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            await _cache.RemoveAsync(key, cacheTimeout?.Token ?? cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(
                "Cache remove timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
        }
        catch (Exception ex)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(ex, "Cache remove failed for key {CacheKey}", key);
        }
    }

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

    private async Task<T?> GetFromPersistentCacheAsync<T>(string key, CancellationToken cancellationToken, bool backfillRedis = true)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entry = await db.CacheEntries.FindAsync([key], cancellationToken);
            if (entry is null)
                return default;

            var now = DateTime.UtcNow;
            if (entry.ExpiresAt <= now)
            {
                db.CacheEntries.Remove(entry);
                await db.SaveChangesAsync(cancellationToken);
                return default;
            }

            if (backfillRedis && !ShouldSkipRedis())
                await TryBackfillDistributedCacheAsync(key, entry.Value, entry.ExpiresAt - now, cancellationToken);

            return JsonSerializer.Deserialize<T>(entry.Value, SerializerOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Persistent cache read failed for key {CacheKey}", key);
            return default;
        }
    }

    private async Task<bool> SetPersistentCacheAsync(string key, byte[] bytes, DateTime expiresAt, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "CacheEntries" ("Key", "Value", "ExpiresAt", "CreatedAt", "UpdatedAt")
                VALUES ({key}, {bytes}, {expiresAt}, {now}, {now})
                ON CONFLICT ("Key") DO UPDATE
                SET "Value" = EXCLUDED."Value",
                    "ExpiresAt" = EXCLUDED."ExpiresAt",
                    "UpdatedAt" = EXCLUDED."UpdatedAt";
                """, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Persistent cache write failed for key {CacheKey}", key);
            return false;
        }
    }

    private async Task BackfillPersistentCacheFromRedisAsync(string key, byte[] bytes, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var expiresAt = now.Add(GetFallbackExpirationForRedisHit(key));

            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "CacheEntries" ("Key", "Value", "ExpiresAt", "CreatedAt", "UpdatedAt")
                VALUES ({key}, {bytes}, {expiresAt}, {now}, {now})
                ON CONFLICT ("Key") DO UPDATE
                SET "Value" = EXCLUDED."Value",
                    "ExpiresAt" = EXCLUDED."ExpiresAt",
                    "UpdatedAt" = EXCLUDED."UpdatedAt"
                WHERE "CacheEntries"."ExpiresAt" <= {now};
                """, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Persistent cache backfill failed for Redis key {CacheKey}", key);
        }
    }

    private async Task RemovePersistentCacheAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entry = await db.CacheEntries.FindAsync([key], cancellationToken);
            if (entry is null)
                return;

            db.CacheEntries.Remove(entry);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Persistent cache remove failed for key {CacheKey}", key);
        }
    }

    private TimeSpan GetFallbackExpirationForRedisHit(string key)
    {
        if (key.StartsWith("transcript:", StringComparison.Ordinal)
            || key.StartsWith("transcript_segments:", StringComparison.Ordinal)
            || key.StartsWith("subtitles:", StringComparison.Ordinal))
        {
            return TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);
        }

        if (key.StartsWith("analytics:", StringComparison.Ordinal))
            return TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds);

        if (key.StartsWith("documents:sas:", StringComparison.Ordinal))
            return TimeSpan.FromSeconds(_cacheOptions.SasUrlSeconds);

        return TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
    }

    private async Task TryBackfillDistributedCacheAsync(
        string key,
        byte[] bytes,
        TimeSpan absoluteExpirationRelativeToNow,
        CancellationToken cancellationToken)
    {
        try
        {
            if (ShouldSkipRedis())
                return;

            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = absoluteExpirationRelativeToNow
            }, cacheTimeout?.Token ?? cancellationToken);
        }
        catch (Exception ex)
        {
            MarkRedisUnavailable();
            _logger.LogWarning(ex, "Cache backfill failed for key {CacheKey}", key);
        }
    }

    private bool ShouldSkipRedis()
        => DateTime.UtcNow < _redisUnavailableUntil;

    private void MarkRedisUnavailable()
        => _redisUnavailableUntil = DateTime.UtcNow.AddSeconds(30);

    private CancellationTokenSource? CreateCacheTimeout(CancellationToken cancellationToken)
    {
        if (_cacheOptions.OperationTimeoutMilliseconds <= 0)
            return null;

        var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMilliseconds(_cacheOptions.OperationTimeoutMilliseconds));
        return timeout;
    }
}
