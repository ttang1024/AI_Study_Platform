using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record TranscribeAudioCommand(Guid DocumentId, Guid UserId) : IRequest<Result<DocumentDto>>;

public class TranscribeAudioCommandHandler : IRequestHandler<TranscribeAudioCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITranscriptionService _transcriptionService;
    private readonly IBlobStorageService _blobStorageService;

    public TranscribeAudioCommandHandler(
        IUnitOfWork unitOfWork,
        ITranscriptionService transcriptionService,
        IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _transcriptionService = transcriptionService;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<DocumentDto>> Handle(TranscribeAudioCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Audio file not found.", "DOCUMENT_NOT_FOUND");

        if (string.IsNullOrEmpty(document.Transcript))
        {
            var stream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);

            var transcript = await _transcriptionService.TranscribeAsync(
                ms.ToArray(), document.ContentType, cancellationToken);

            document.Transcript = transcript;
            document.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Documents.Update(document);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        var dto = new DocumentDto(
            document.DocumentId, document.CourseId, document.UserId,
            document.FileName, document.BlobUrl, document.ContentType,
            document.FileSize, document.Summary, document.MindMapText,
            document.CreatedAt, document.UpdatedAt, document.Transcript);

        return Result<DocumentDto>.Success(dto, "Audio transcribed successfully.");
    }
}
