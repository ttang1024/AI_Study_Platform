using Microsoft.Extensions.Diagnostics.HealthChecks;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.HealthChecks;

/// <summary>
/// Postgres reachability. This is the one dependency with no fallback — every request path reads from
/// it — so a failure here is Unhealthy, which takes the pod out of the load balancer.
/// </summary>
public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly AppDbContext _db;

    public DatabaseHealthCheck(AppDbContext db) => _db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // CanConnectAsync opens a connection and runs the provider's trivial probe query. It is the
            // cheapest thing that actually proves the server is answering, not merely that a socket opens.
            return await _db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy("Postgres reachable.")
                : HealthCheckResult.Unhealthy("Postgres did not answer.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Postgres unreachable.", ex);
        }
    }
}
