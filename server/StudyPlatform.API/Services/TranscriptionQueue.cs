using System.Collections.Concurrent;
using System.Threading.Channels;
using MediatR;
using StudyPlatform.Application.Common;
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
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var documents = await unitOfWork.Documents.GetPendingTranscriptionsAsync(stoppingToken);
            foreach (var job in documents)
                TryEnqueue(job.DocumentId, job.UserId,
                    job.ContentType == "audio/podcast" ? TranscriptionJobKind.Podcast : TranscriptionJobKind.Audio);

            var videos = await unitOfWork.Videos.GetPendingTranscriptionsAsync(stoppingToken);
            foreach (var job in videos)
                TryEnqueue(job.VideoRecordId, job.UserId, TranscriptionJobKind.UploadedVideo);

            var total = documents.Count + videos.Count;
            if (total > 0)
                _logger.LogInformation("Re-queued {Count} transcription(s) interrupted by the last shutdown", total);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Best-effort: a database hiccup at startup must not stop new jobs from running.
            _logger.LogError(ex, "Could not recover pending transcriptions at startup");
        }
    }

    private async Task AbandonAsync(TranscriptionJob job, CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            _ = job.Kind == TranscriptionJobKind.UploadedVideo
                ? await mediator.Send(new AbandonVideoTranscriptionCommand(job.ItemId), stoppingToken)
                : await mediator.Send(new AbandonTranscriptionCommand(job.ItemId), stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Could not clear the transcription marker for {ItemId}", job.ItemId);
        }
    }

    private sealed record TranscriptionJob(Guid ItemId, Guid UserId, TranscriptionJobKind Kind);
}
