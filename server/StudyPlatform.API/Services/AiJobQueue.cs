using System.Collections.Concurrent;
using System.Threading.Channels;
using MediatR;
using StudyPlatform.Application.AiJobs;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Services;

/// <summary>
/// Runs queued AI generations off the request thread. Mirrors AudioTranscriptionQueue: single reader,
/// per-job dedupe.
///
/// The AI credentials arrive as per-request X-AI-* headers, and a background worker has no HttpContext
/// to read them from — so the enqueuing request captures them and they ride along with the job in
/// memory, to be pushed onto AmbientAiCredentials for the duration of the run. They are deliberately
/// never persisted alongside the job row.
/// </summary>
public sealed class AiJobQueue : BackgroundService
{
    private readonly Channel<(Guid JobId, AiCredentials Credentials)> _queue =
        Channel.CreateUnbounded<(Guid, AiCredentials)>(new UnboundedChannelOptions { SingleReader = true });

    private readonly ConcurrentDictionary<Guid, byte> _queuedOrRunning = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AiJobQueue> _logger;

    public AiJobQueue(IServiceScopeFactory scopeFactory, ILogger<AiJobQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public bool TryEnqueue(Guid jobId, AiCredentials credentials)
    {
        if (!_queuedOrRunning.TryAdd(jobId, 0))
            return false;

        if (_queue.Writer.TryWrite((jobId, credentials)))
            return true;

        _queuedOrRunning.TryRemove(jobId, out _);
        return false;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var (jobId, credentials) in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

                // Everything downstream — AiService, the usage recorder — reads the credentials from here.
                using (AmbientAiCredentials.Push(credentials))
                {
                    await mediator.Send(new RunAiJobCommand(jobId), stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // RunAiJobCommand already records failures on the job row; this is the belt-and-braces
                // case where sending the command itself blew up.
                _logger.LogError(ex, "AI job {JobId} could not be run", jobId);
            }
            finally
            {
                _queuedOrRunning.TryRemove(jobId, out _);
            }
        }
    }
}
