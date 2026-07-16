using System.Collections.Concurrent;
using System.Threading.Channels;
using MediatR;
using StudyPlatform.Application.Courses;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Services;

/// <summary>
/// In-process queue for audio-overview generation (script → per-turn TTS → stitch → upload).
/// Mirrors AudioTranscriptionQueue: single reader, per-overview dedupe.
///
/// The script step calls the AI, and the AI credentials only exist as headers on the originating
/// request — so the enqueuing request captures them and they are pushed onto AmbientAiCredentials
/// for the run. Without that, this worker has no HttpContext to read a key from at all.
/// </summary>
public sealed class AudioOverviewQueue : BackgroundService
{
    private readonly Channel<(Guid OverviewId, AiCredentials Credentials)> _queue =
        Channel.CreateUnbounded<(Guid, AiCredentials)>(new UnboundedChannelOptions { SingleReader = true });

    private readonly ConcurrentDictionary<Guid, byte> _queuedOrRunning = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AudioOverviewQueue> _logger;

    public AudioOverviewQueue(IServiceScopeFactory scopeFactory, ILogger<AudioOverviewQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public bool TryEnqueue(Guid overviewId, AiCredentials credentials)
    {
        if (!_queuedOrRunning.TryAdd(overviewId, 0))
            return false;

        if (_queue.Writer.TryWrite((overviewId, credentials)))
            return true;

        _queuedOrRunning.TryRemove(overviewId, out _);
        return false;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var (overviewId, credentials) in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

                using (AmbientAiCredentials.Push(credentials))
                {
                    await mediator.Send(new GenerateAudioOverviewCommand(overviewId), stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Audio overview generation failed for {OverviewId}", overviewId);
            }
            finally
            {
                _queuedOrRunning.TryRemove(overviewId, out _);
            }
        }
    }
}
