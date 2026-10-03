using Microsoft.Extensions.Caching.Distributed;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// The <see cref="IDistributedCache"/> used when Redis is turned off (<c>Redis:Enabled=false</c>,
/// the default). It stores nothing and every read misses.
///
/// That is deliberate rather than lazy. <see cref="DistributedAppCache"/> is already two-tier: it
/// writes through to the Postgres <c>CacheEntries</c> table and reads from it whenever the
/// distributed tier misses, so dropping the distributed tier costs nothing in correctness — the
/// Postgres tier keeps serving the same values, shared by every replica and invalidated by the same
/// <c>RemoveAsync</c> calls.
///
/// An in-process <c>MemoryDistributedCache</c> would be the obvious alternative and is worse on both
/// counts: it is not shared, so one ECS task's write and another's invalidation never meet (stale
/// reads once the service runs more than one task), and a hit in it still triggers the Postgres
/// backfill write in <see cref="DistributedAppCache.GetAsync{T}"/> — so it does not even save a round
/// trip.
/// </summary>
public sealed class NoOpDistributedCache : IDistributedCache
{
    public byte[]? Get(string key) => null;

    public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => Task.FromResult<byte[]?>(null);

    public void Refresh(string key) { }

    public Task RefreshAsync(string key, CancellationToken token = default) => Task.CompletedTask;

    public void Remove(string key) { }

    public Task RemoveAsync(string key, CancellationToken token = default) => Task.CompletedTask;

    public void Set(string key, byte[] value, DistributedCacheEntryOptions options) { }

    public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default)
        => Task.CompletedTask;
}
