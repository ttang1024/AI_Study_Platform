namespace StudyPlatform.API.Services;

/// <summary>
/// The loop every polling worker in this process runs: sweep, swallow and log whatever the sweep
/// threw, wait, repeat — and unwind promptly when the host is shutting down.
///
/// <para>Written once because the failure mode it guards against is subtle and identical in all of
/// them: an exception escaping <see cref="BackgroundService.ExecuteAsync"/> kills the worker for the
/// life of the process, silently. A subclass supplies only the interval and the sweep, so it cannot
/// get the shutdown or the never-die guarantee wrong.</para>
/// </summary>
public abstract class PeriodicSweepWorker : BackgroundService
{
    private readonly ILogger _logger;

    protected PeriodicSweepWorker(ILogger logger)
    {
        _logger = logger;
    }

    /// <summary>How long to wait between sweeps.</summary>
    protected abstract TimeSpan SweepInterval { get; }

    /// <summary>What a failed sweep is called in the log, e.g. "Account deletion".</summary>
    protected abstract string SweepName { get; }

    /// <summary>
    /// Whether a failed sweep is worth an error. Workers whose sweep is expected to fail
    /// occasionally — a poll that races a restart, say — override this down to a warning.
    /// </summary>
    protected virtual LogLevel SweepFailureLevel => LogLevel.Error;

    /// <summary>
    /// Runs once before the first sweep. Return <c>false</c> to skip the loop entirely, which is how
    /// a worker opts out when the feature it serves is not configured.
    /// </summary>
    protected virtual Task<bool> OnStartingAsync(CancellationToken cancellationToken) => Task.FromResult(true);

    /// <summary>One pass of the worker's actual job. May throw; the loop survives it.</summary>
    protected abstract Task SweepAsync(CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!await OnStartingAsync(stoppingToken))
            return;

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
                _logger.Log(SweepFailureLevel, ex, "{Sweep} sweep failed; will retry.", SweepName);
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
}
