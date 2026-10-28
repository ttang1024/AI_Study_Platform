using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Podcasts.Commands;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Workers;

/// <summary>
/// The queue is in memory and every deploy replaces the container; the persisted marker is what makes
/// an interrupted transcription come back instead of hanging forever.
/// </summary>
public class TranscriptionQueueTests
{
    private readonly Mock<IMediator> _mediator = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();

    private TranscriptionQueue CreateQueue()
    {
        _documents.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _videos.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        var services = new ServiceCollection()
            .AddSingleton(_mediator.Object)
            .AddSingleton(_documents.Object)
            .AddSingleton(_videos.Object)
            .BuildServiceProvider();
        return new TranscriptionQueue(
            services.GetRequiredService<IServiceScopeFactory>(), NullLogger<TranscriptionQueue>.Instance);
    }

    private static async Task RunUntil(TranscriptionQueue queue, Func<bool> done)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await queue.StartAsync(cts.Token);
        while (!done() && !cts.IsCancellationRequested)
            await Task.Delay(20);
        await queue.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task OnStart_RequeuesTranscriptionsInterruptedByTheLastShutdown()
    {
        var queue = CreateQueue();
        var audio = new PendingTranscription(Guid.NewGuid(), Guid.NewGuid(), "audio/mpeg", DateTime.UtcNow);
        var podcast = new PendingTranscription(Guid.NewGuid(), Guid.NewGuid(), "audio/podcast", DateTime.UtcNow);
        _documents.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([audio, podcast]);
        var ran = 0;
        _mediator.Setup(m => m.Send(It.IsAny<TranscribeAudioCommand>(), It.IsAny<CancellationToken>()))
            .Callback(() => Interlocked.Increment(ref ran))
            .ReturnsAsync(Result<DocumentDto>.Success(null!));
        _mediator.Setup(m => m.Send(It.IsAny<TranscribePodcastCommand>(), It.IsAny<CancellationToken>()))
            .Callback(() => Interlocked.Increment(ref ran))
            .ReturnsAsync(Result<DocumentDto>.Success(null!));

        await RunUntil(queue, () => Volatile.Read(ref ran) == 2);

        _mediator.Verify(m => m.Send(new TranscribeAudioCommand(audio.DocumentId, audio.UserId), It.IsAny<CancellationToken>()), Times.Once);
        _mediator.Verify(m => m.Send(new TranscribePodcastCommand(podcast.DocumentId, podcast.UserId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task FailedTranscription_ClearsTheMarker_SoItIsNotRetriedOnEveryRestart()
    {
        var queue = CreateQueue();
        var job = new PendingTranscription(Guid.NewGuid(), Guid.NewGuid(), "audio/mpeg", DateTime.UtcNow);
        _documents.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([job]);
        _mediator.Setup(m => m.Send(It.IsAny<TranscribeAudioCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<DocumentDto>.Failure("bad file", "TRANSCRIPTION_FAILED"));
        var abandoned = false;
        _mediator.Setup(m => m.Send(It.IsAny<AbandonTranscriptionCommand>(), It.IsAny<CancellationToken>()))
            .Callback(() => abandoned = true)
            .ReturnsAsync(Result.Success());

        await RunUntil(queue, () => abandoned);

        _mediator.Verify(m => m.Send(new AbandonTranscriptionCommand(job.DocumentId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnStart_AJobPendingTooLong_IsAbandoned_NotRequeued()
    {
        // The marker survives a crash, so a file that crashes the process would otherwise be re-queued by
        // every restart it causes.
        var queue = CreateQueue();
        var stale = new PendingTranscription(Guid.NewGuid(), Guid.NewGuid(), "audio/mpeg",
            DateTime.UtcNow - TranscriptionQueue.MaxPendingAge - TimeSpan.FromMinutes(1));
        _documents.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([stale]);
        var abandoned = false;
        _mediator.Setup(m => m.Send(It.IsAny<AbandonTranscriptionCommand>(), It.IsAny<CancellationToken>()))
            .Callback(() => abandoned = true)
            .ReturnsAsync(Result.Success());

        await RunUntil(queue, () => abandoned);

        _mediator.Verify(m => m.Send(new AbandonTranscriptionCommand(stale.DocumentId), It.IsAny<CancellationToken>()), Times.Once);
        _mediator.Verify(m => m.Send(It.IsAny<TranscribeAudioCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}

public class TranscriptionQueueVideoTests
{
    [Fact]
    public async Task OnStart_RequeuesInterruptedVideoUploads_AndAbandonsFailuresAsVideos()
    {
        var mediator = new Mock<IMediator>();
        var documents = new Mock<IDocumentRepository>();
        var videos = new Mock<IVideoRepository>();
        documents.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        var pending = new PendingVideoTranscription(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow);
        videos.Setup(r => r.GetPendingTranscriptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([pending]);
        mediator.Setup(m => m.Send(It.IsAny<TranscribeUploadedVideoCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure("broken file", "TRANSCRIPTION_FAILED"));
        var abandoned = false;
        mediator.Setup(m => m.Send(It.IsAny<AbandonVideoTranscriptionCommand>(), It.IsAny<CancellationToken>()))
            .Callback(() => abandoned = true).ReturnsAsync(Result.Success());
        var services = new ServiceCollection().AddSingleton(mediator.Object)
            .AddSingleton(documents.Object).AddSingleton(videos.Object).BuildServiceProvider();
        var queue = new TranscriptionQueue(services.GetRequiredService<IServiceScopeFactory>(), NullLogger<TranscriptionQueue>.Instance);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await queue.StartAsync(cts.Token);
        while (!abandoned && !cts.IsCancellationRequested) await Task.Delay(20);
        await queue.StopAsync(CancellationToken.None);

        mediator.Verify(m => m.Send(new TranscribeUploadedVideoCommand(pending.VideoRecordId, pending.UserId), It.IsAny<CancellationToken>()), Times.Once);
        mediator.Verify(m => m.Send(new AbandonVideoTranscriptionCommand(pending.VideoRecordId), It.IsAny<CancellationToken>()), Times.Once);
        mediator.Verify(m => m.Send(It.IsAny<AbandonTranscriptionCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}

public class TranscriptionRequestCommandTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();

    [Fact]
    public async Task Request_MarksOnlyTheCallersDocument()
    {
        var owner = Guid.NewGuid();
        var doc = new Document { DocumentId = Guid.NewGuid(), UserId = owner };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        var handler = new RequestTranscriptionCommandHandler(_uow.Object, _documents.Object);

        Assert.False((await handler.Handle(new RequestTranscriptionCommand(doc.DocumentId, Guid.NewGuid()), default)).IsSuccess);
        Assert.Null(doc.TranscriptionRequestedAt);

        Assert.True((await handler.Handle(new RequestTranscriptionCommand(doc.DocumentId, owner), default)).IsSuccess);
        Assert.NotNull(doc.TranscriptionRequestedAt);
    }

    [Fact]
    public async Task Abandon_ClearsTheMarker()
    {
        var doc = new Document { DocumentId = Guid.NewGuid(), TranscriptionRequestedAt = DateTime.UtcNow };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        await new AbandonTranscriptionCommandHandler(_uow.Object, _documents.Object).Handle(new AbandonTranscriptionCommand(doc.DocumentId), default);

        Assert.Null(doc.TranscriptionRequestedAt);
    }
}
