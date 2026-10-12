using StudyPlatform.Application.Services;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>A dictionary-backed <see cref="IAppCache"/> for handlers whose behaviour depends on what the cache holds.</summary>
public sealed class InMemoryAppCache : IAppCache
{
    private readonly Dictionary<string, (object? Value, DateTime ExpiresAt)> _entries = new();

    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
        => Task.FromResult(_entries.TryGetValue(key, out var e) && e.ExpiresAt > DateTime.UtcNow ? (T?)e.Value : default);

    public Task SetAsync<T>(string key, T value, TimeSpan absoluteExpirationRelativeToNow, CancellationToken cancellationToken = default)
    {
        _entries[key] = (value, DateTime.UtcNow.Add(absoluteExpirationRelativeToNow));
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        _entries.Remove(key);
        return Task.CompletedTask;
    }

    public async Task<T> GetOrCreateAsync<T>(
        string key, Func<CancellationToken, Task<T>> factory, TimeSpan absoluteExpirationRelativeToNow, CancellationToken cancellationToken = default)
    {
        if (_entries.TryGetValue(key, out var e) && e.ExpiresAt > DateTime.UtcNow)
            return (T)e.Value!;
        var value = await factory(cancellationToken);
        await SetAsync(key, value, absoluteExpirationRelativeToNow, cancellationToken);
        return value;
    }

    public IReadOnlyCollection<string> Keys => _entries.Keys;
}
