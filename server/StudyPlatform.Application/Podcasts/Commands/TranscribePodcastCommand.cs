using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Podcasts.Commands;

public record TranscribePodcastCommand(Guid DocumentId, Guid UserId) : IRequest<Result<DocumentDto>>;

public class TranscribePodcastCommandHandler : IRequestHandler<TranscribePodcastCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITranscriptionService _transcriptionService;
    private readonly IApplePodcastService _podcastService;

    public TranscribePodcastCommandHandler(
        IUnitOfWork unitOfWork,
        ITranscriptionService transcriptionService,
        IApplePodcastService podcastService)
    {
        _unitOfWork = unitOfWork;
        _transcriptionService = transcriptionService;
        _podcastService = podcastService;
    }

    public async Task<Result<DocumentDto>> Handle(TranscribePodcastCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Podcast episode not found.", "DOCUMENT_NOT_FOUND");

        if (document.ContentType != "audio/podcast")
            return Result<DocumentDto>.Failure("Document is not a podcast episode.", "INVALID_DOCUMENT_TYPE");

        if (string.IsNullOrEmpty(document.Transcript))
        {
            var download = await _podcastService.DownloadAudioAsync(document.BlobUrl, cancellationToken);
            if (download == null)
                return Result<DocumentDto>.Failure("Failed to download podcast audio.", "DOWNLOAD_FAILED");

            var transcript = await _transcriptionService.TranscribeAsync(
                download.Value.AudioData, download.Value.MimeType, cancellationToken);

            document.Transcript = transcript;
            document.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Documents.Update(document);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result<DocumentDto>.Success(document.ToDocumentDto(),
            "Podcast transcribed successfully.");
    }
}
