using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Fails AI jobs that have been queued or running for implausibly long.
///
/// <para>Two failure modes converge here. A job is replica-affine — its provider credentials exist
/// only in the accepting instance's memory — so if that instance restarts or dies, nothing will
/// ever pick the job up. And a run can simply hang on a provider that never answers. In both cases
/// the row sits at "queued" or "running" forever, and the user watches a spinner with no way to
/// retry, because the UI has no reason to believe the job is dead.</para>
///
/// <para>Age is the signal rather than an instance heartbeat: it needs no extra table, and it
/// catches the hung-run case that a liveness check would miss. It also cleans up jobs stranded by
/// an ordinary deploy, which was already possible on a single replica.</para>
/// </summary>
public sealed class StaleAiJobReaper : BackgroundService
{
    /// <summary>
    /// Generous on purpose. Legitimate generations against a slow provider on a long document take
    /// minutes; failing a job that is merely slow would be worse than leaving it a while longer.
    /// </summary>
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(30);

    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StaleAiJobReaper> _logger;

    public StaleAiJobReaper(IServiceScopeFactory scopeFactory, ILogger<StaleAiJobReaper> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Sweep once at startup as well as on the timer: a deploy is the single most likely cause of
        // orphaned jobs, and the users affected are waiting right now.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Never let the reaper die; a transient database blip must not stop future sweeps.
                _logger.LogWarning(ex, "Stale AI job sweep failed; will retry.");
            }

            try
            {
                await Task.Delay(SweepInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - StaleAfter;

        var stale = await db.AiJobs
            .Where(j => (j.Status == AiJobStatus.Queued || j.Status == AiJobStatus.Running)
                        && (j.StartedAt ?? j.CreatedAt) < cutoff)
            .ToListAsync(cancellationToken);

        if (stale.Count == 0) return;

        foreach (var job in stale)
        {
            job.Status = AiJobStatus.Failed;
            job.CompletedAt = DateTime.UtcNow;

            // Phrased for the person looking at it, not the operator: the actionable fact is that
            // retrying will work, since a fresh request carries fresh credentials.
            job.Error = "This generation was interrupted and did not finish. Please try again.";
        }

        await db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Failed {Count} stale AI job(s) that had been pending longer than {Minutes} minutes.",
            stale.Count, StaleAfter.TotalMinutes);
    }
}
