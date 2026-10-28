using System.Collections.Concurrent;
using System.Threading.Channels;
using MediatR;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Podcasts.Commands;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Services;

public enum TranscriptionJobKind
{
    Audio,
    Podcast,
    UploadedVideo,
}

/// <summary>
/// Runs Whisper transcriptions (audio documents, podcast episodes, uploaded videos) one at a time, off
/// the request path.
///
/// <para>One at a time on purpose: local Whisper is CPU- and memory-bound, and this shares a small
/// instance with the API. The channel itself is in memory and every deploy replaces the container, so
/// each item also carries a persisted TranscriptionRequestedAt marker; on start, anything still marked
/// is re-queued, and a failed job clears its marker so it is not retried on every restart.</para>
/// </summary>
public sealed class TranscriptionQueue : BackgroundService
{
    /// <summary>
    /// A job still pending this long after it was requested is not re-queued at startup but abandoned.
    /// The marker survives a crash by design, so a file that takes the process down with it (Whisper
    /// running out of memory on a very long recording) was re-queued by every restart it caused — a
    /// crash loop that also starved every other user's transcription.
    /// </summary>
    internal static readonly TimeSpan MaxPendingAge = TimeSpan.FromHours(12);

    private static readonly TimeSpan AbandonRetryDelay = TimeSpan.FromSeconds(10);
    private const int AbandonAttempts = 3;

    private readonly Channel<TranscriptionJob> _queue = Channel.CreateUnbounded<TranscriptionJob>(
        new UnboundedChannelOptions { SingleReader = true });
    private readonly ConcurrentDictionary<Guid, byte> _queuedOrRunning = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TranscriptionQueue> _logger;

    public TranscriptionQueue(IServiceScopeFactory scopeFactory, ILogger<TranscriptionQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <summary>Queues a job; false when the same item is already queued or running.</summary>
    public bool TryEnqueue(Guid itemId, Guid userId, TranscriptionJobKind kind)
    {
        if (!_queuedOrRunning.TryAdd(itemId, 0))
            return false;

        if (_queue.Writer.TryWrite(new TranscriptionJob(itemId, userId, kind)))
            return true;

        _queuedOrRunning.TryRemove(itemId, out _);
        return false;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverPendingAsync(stoppingToken);

        await foreach (var job in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            var succeeded = false;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                var (ok, error) = await RunAsync(mediator, job, stoppingToken);
                succeeded = ok;
                if (!succeeded)
                    _logger.LogWarning("{Kind} transcription failed for {ItemId}: {Error}", job.Kind, job.ItemId, error);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Shutting down mid-job: the marker stays set, so the next start picks this job up again.
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{Kind} transcription failed for {ItemId}", job.Kind, job.ItemId);
            }
            finally
            {
                _queuedOrRunning.TryRemove(job.ItemId, out _);
            }

            if (!succeeded)
                await AbandonAsync(job, stoppingToken);
        }
    }

    private static async Task<(bool Ok, string? Error)> RunAsync(IMediator mediator, TranscriptionJob job, CancellationToken cancellationToken)
    {
        switch (job.Kind)
        {
            case TranscriptionJobKind.Podcast:
            {
                var result = await mediator.Send(new TranscribePodcastCommand(job.ItemId, job.UserId), cancellationToken);
                return (result.IsSuccess, result.ErrorCode);
            }
            case TranscriptionJobKind.UploadedVideo:
            {
                var result = await mediator.Send(new TranscribeUploadedVideoCommand(job.ItemId, job.UserId), cancellationToken);
                return (result.IsSuccess, result.ErrorCode);
            }
            default:
            {
                var result = await mediator.Send(new TranscribeAudioCommand(job.ItemId, job.UserId), cancellationToken);
                return (result.IsSuccess, result.ErrorCode);
            }
        }
    }

    private async Task RecoverPendingAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var documentRepository = scope.ServiceProvider.GetRequiredService<IDocumentRepository>();
            var videoRepository = scope.ServiceProvider.GetRequiredService<IVideoRepository>();

            var documents = await documentRepository.GetPendingTranscriptionsAsync(stoppingToken);
            var videos = await videoRepository.GetPendingTranscriptionsAsync(stoppingToken);
            var pending = documents
                .Select(d => (Job: new TranscriptionJob(d.DocumentId, d.UserId,
                    d.ContentType == "audio/podcast" ? TranscriptionJobKind.Podcast : TranscriptionJobKind.Audio), d.RequestedAt))
                .Concat(videos.Select(v => (Job: new TranscriptionJob(v.VideoRecordId, v.UserId, TranscriptionJobKind.UploadedVideo), v.RequestedAt)))
                .ToList();

            var cutoff = DateTime.UtcNow - MaxPendingAge;
            var requeued = 0;
            foreach (var (job, requestedAt) in pending)
            {
                if (requestedAt < cutoff)
                {
                    _logger.LogWarning(
                        "Abandoning {Kind} transcription {ItemId}: still pending {Age} after it was requested",
                        job.Kind, job.ItemId, DateTime.UtcNow - requestedAt);
                    await AbandonAsync(job, stoppingToken);
                    continue;
                }
                if (TryEnqueue(job.ItemId, job.UserId, job.Kind))
                    requeued++;
            }

            if (requeued > 0)
                _logger.LogInformation("Re-queued {Count} transcription(s) interrupted by the last shutdown", requeued);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Best-effort: a database hiccup at startup must not stop new jobs from running.
            _logger.LogError(ex, "Could not recover pending transcriptions at startup");
        }
    }

    /// <summary>
    /// Retried briefly: a job that failed because the database blipped tends to fail its abandon for the
    /// same reason, and a marker left set shows the user "transcribing" until the next restart.
    /// </summary>
    private async Task AbandonAsync(TranscriptionJob job, CancellationToken stoppingToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                _ = job.Kind == TranscriptionJobKind.UploadedVideo
                    ? await mediator.Send(new AbandonVideoTranscriptionCommand(job.ItemId), stoppingToken)
                    : await mediator.Send(new AbandonTranscriptionCommand(job.ItemId), stoppingToken);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                if (attempt >= AbandonAttempts)
                {
                    _logger.LogError(ex, "Could not clear the transcription marker for {ItemId}", job.ItemId);
                    return;
                }
                _logger.LogWarning(ex, "Clearing the transcription marker for {ItemId} failed; retrying", job.ItemId);
                await Task.Delay(AbandonRetryDelay, stoppingToken);
            }
        }
    }

    private sealed record TranscriptionJob(Guid ItemId, Guid UserId, TranscriptionJobKind Kind);
}
