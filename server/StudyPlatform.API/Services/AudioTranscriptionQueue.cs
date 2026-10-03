using System.Collections.Concurrent;
using System.Threading.Channels;
using MediatR;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Podcasts.Commands;

namespace StudyPlatform.API.Services;

public sealed class AudioTranscriptionQueue : BackgroundService
{
    private readonly Channel<AudioTranscriptionJob> _queue = Channel.CreateUnbounded<AudioTranscriptionJob>(
        new UnboundedChannelOptions { SingleReader = true });
    private readonly ConcurrentDictionary<Guid, byte> _queuedOrRunning = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AudioTranscriptionQueue> _logger;

    public AudioTranscriptionQueue(
        IServiceScopeFactory scopeFactory,
        ILogger<AudioTranscriptionQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public bool TryEnqueue(Guid documentId, Guid userId, bool isPodcast)
    {
        if (!_queuedOrRunning.TryAdd(documentId, 0))
            return false;

        if (_queue.Writer.TryWrite(new AudioTranscriptionJob(documentId, userId, isPodcast)))
            return true;

        _queuedOrRunning.TryRemove(documentId, out _);
        return false;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

                if (job.IsPodcast)
                    await mediator.Send(new TranscribePodcastCommand(job.DocumentId, job.UserId), stoppingToken);
                else
                    await mediator.Send(new TranscribeAudioCommand(job.DocumentId, job.UserId), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Audio transcription failed for document {DocumentId}", job.DocumentId);
            }
            finally
            {
                _queuedOrRunning.TryRemove(job.DocumentId, out _);
            }
        }
    }

    private sealed record AudioTranscriptionJob(Guid DocumentId, Guid UserId, bool IsPodcast);
}
