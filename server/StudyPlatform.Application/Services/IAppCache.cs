namespace StudyPlatform.Application.Services;

public interface IAppCache
{
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    Task SetAsync<T>(string key, T value, TimeSpan absoluteExpirationRelativeToNow, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    Task<T> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan absoluteExpirationRelativeToNow,
        CancellationToken cancellationToken = default);
}
