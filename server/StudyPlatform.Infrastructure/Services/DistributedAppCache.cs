using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

public class DistributedAppCache : IAppCache
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly IDistributedCache _cache;
    private readonly ILogger<DistributedAppCache> _logger;
    private readonly CacheOptions _cacheOptions;

    public DistributedAppCache(
        IDistributedCache cache,
        ILogger<DistributedAppCache> logger,
        IOptions<CacheOptions> cacheOptions)
    {
        _cache = cache;
        _logger = logger;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            var bytes = await _cache.GetAsync(key, cacheTimeout?.Token ?? cancellationToken);
            if (bytes is null || bytes.Length == 0)
                return default;

            return JsonSerializer.Deserialize<T>(bytes, SerializerOptions);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Cache read timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
            return default;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache read failed for key {CacheKey}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan absoluteExpirationRelativeToNow, CancellationToken cancellationToken = default)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, SerializerOptions);
            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = absoluteExpirationRelativeToNow
            }, cacheTimeout?.Token ?? cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Cache write timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache write failed for key {CacheKey}", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            using var cacheTimeout = CreateCacheTimeout(cancellationToken);
            await _cache.RemoveAsync(key, cacheTimeout?.Token ?? cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Cache remove timed out after {TimeoutMilliseconds} ms for key {CacheKey}",
                _cacheOptions.OperationTimeoutMilliseconds,
                key);
        }
        catch (Exception ex)
        {
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

    private CancellationTokenSource? CreateCacheTimeout(CancellationToken cancellationToken)
    {
        if (_cacheOptions.OperationTimeoutMilliseconds <= 0)
            return null;

        var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMilliseconds(_cacheOptions.OperationTimeoutMilliseconds));
        return timeout;
    }
}
