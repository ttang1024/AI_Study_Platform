using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StudyPlatform.API.Extensions;

namespace StudyPlatform.API.HealthChecks;

/// <summary>
/// Reachability of the configured distributed cache.
///
/// Redis is optional and off by default, and a deployment that never asked for it has nothing to
/// probe: the check reports Healthy immediately rather than describing the absence of an unrequested
/// dependency as a problem. Only when Redis is actually enabled does a round trip run.
///
/// A failure here is Degraded, never Unhealthy: <c>IAppCache</c> falls back to the Postgres CacheEntries
/// tier when Redis is down, so the API still serves correct (slower) responses. Reporting Unhealthy would
/// pull a working pod out of the load balancer and turn a cache outage into an outage.
///
/// Note this deliberately probes <see cref="IDistributedCache"/> and not <c>IAppCache</c> — the latter
/// would silently succeed via its Postgres fallback and could never tell us Redis had gone away.
/// </summary>
public sealed class CacheHealthCheck : IHealthCheck
{
    /// <summary>The probe is a liveness signal, not a latency budget — a slow cache is still a down cache to us.</summary>
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(2);

    private const string ProbeKey = "health:probe";

    private readonly IDistributedCache _cache;
    private readonly CacheBackend _backend;

    public CacheHealthCheck(IDistributedCache cache, CacheBackend backend)
    {
        _cache = cache;
        _backend = backend;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        // No Redis, nothing to probe. The Postgres cache tier is the cache, and the postgres check
        // already covers it — so this must not drag readiness down.
        if (!_backend.UsesRedis)
            return HealthCheckResult.Healthy($"No distributed cache configured; serving from the {_backend.Description}.");

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(ProbeTimeout);

        try
        {
            // A write-then-read round trip: GET alone succeeds against a Redis that has gone read-only.
            await _cache.SetStringAsync(
                ProbeKey,
                DateTime.UtcNow.ToString("O"),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ProbeTimeout },
                timeout.Token);

            var value = await _cache.GetStringAsync(ProbeKey, timeout.Token);

            return value is null
                ? HealthCheckResult.Degraded("Cache accepted a write but returned nothing; serving from the Postgres cache tier.")
                : HealthCheckResult.Healthy("Cache reachable.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Degraded($"Cache did not respond within {ProbeTimeout.TotalSeconds:0}s; serving from the Postgres cache tier.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("Cache unreachable; serving from the Postgres cache tier.", ex);
        }
    }
}
