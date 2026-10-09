using System.Collections.Concurrent;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Collapses concurrent calls for the same key into one execution: callers that arrive while a
/// call is running await that call's result instead of starting their own. Nothing is kept once
/// the call finishes — caching results is the caller's job.
/// </summary>
/// <remarks>
/// The shared call runs on its own token, never a caller's, so one caller leaving does not cancel
/// it for the rest; each caller can still stop waiting through its own token.
/// </remarks>
internal sealed class SingleFlight<TKey, TValue> where TKey : notnull
{
    private readonly ConcurrentDictionary<TKey, Lazy<Task<TValue>>> _inFlight = new();

    public Task<TValue> RunAsync(TKey key, Func<Task<TValue>> work, CancellationToken callerToken)
    {
        Lazy<Task<TValue>>? entry = null;
        entry = _inFlight.GetOrAdd(key, _ => new Lazy<Task<TValue>>(async () =>
        {
            try { return await work(); }
            finally { _inFlight.TryRemove(new KeyValuePair<TKey, Lazy<Task<TValue>>>(key, entry!)); }
        }));
        return entry.Value.WaitAsync(callerToken);
    }
}
