using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

/// <summary>
/// Transcribes an uploaded video in the background (TranscriptionQueue). Used to run inside the upload
/// request, which held the whole file in memory twice and outlived CloudFront's 60-second origin timeout
/// on anything but a short clip.
/// </summary>
public record TranscribeUploadedVideoCommand(Guid VideoRecordId, Guid UserId) : IRequest<Result>;

public class TranscribeUploadedVideoCommandHandler : IRequestHandler<TranscribeUploadedVideoCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;
    private readonly ITranscriptionService _transcription;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly TimeSpan _ttl;

    public TranscribeUploadedVideoCommandHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorage,
        ITranscriptionService transcription,
        IVideoTranscriptProvider transcripts,
        IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
        _transcription = transcription;
        _transcripts = transcripts;
        _ttl = TimeSpan.FromSeconds(cacheOptions.Value.TranscriptSeconds);
    }

    public async Task<Result> Handle(TranscribeUploadedVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetOwnedAsync(request.VideoRecordId, request.UserId, cancellationToken);
        if (video == null || !string.Equals(video.SourceType, "upload", StringComparison.OrdinalIgnoreCase))
            return Result.Failure("Uploaded video not found.", "VIDEO_NOT_FOUND");

        if (string.IsNullOrEmpty(video.Transcript))
        {
            byte[] bytes;
            await using (var stream = await _blobStorage.DownloadAsync(video.VideoUrl, cancellationToken))
            using (var buffer = new MemoryStream())
            {
                await stream.CopyToAsync(buffer, cancellationToken);
                bytes = buffer.ToArray();
            }

            var transcriptJson = await _transcription.TranscribeAsync(
                bytes, MediaFormatting.GetVideoContentType(video.VideoUrl), cancellationToken);
            var segments = TranscriptSegmentation.ParseWhisper(transcriptJson);

            video.Transcript = string.Join(" ", segments.Select(s => s.Text));
            await _transcripts.StoreSegmentsAsync(
                IVideoTranscriptProvider.KeyFor(video), TranscriptKinds.Transcript, segments, _ttl, cancellationToken);
        }

        video.TranscriptionRequestedAt = null;
        video.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

/// <summary>Clears the in-flight marker after a failed transcription, so restarts do not retry it forever.</summary>
public record AbandonVideoTranscriptionCommand(Guid VideoRecordId) : IRequest<Result>;

public class AbandonVideoTranscriptionCommandHandler : IRequestHandler<AbandonVideoTranscriptionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public AbandonVideoTranscriptionCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(AbandonVideoTranscriptionCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdAsync(request.VideoRecordId, cancellationToken);
        if (video == null)
            return Result.Success();

        video.TranscriptionRequestedAt = null;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
