using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record UploadDocumentCommand(
    Guid CourseId,
    Guid UserId,
    string FileName,
    string ContentType,
    long FileSize,
    Stream FileStream) : IRequest<Result<DocumentDto>>;

public class UploadDocumentCommandHandler : IRequestHandler<UploadDocumentCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;
    private readonly ILogger<UploadDocumentCommandHandler> _logger;
    private readonly AppLimitsOptions _limits;

    public UploadDocumentCommandHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorageService,
        IOptions<AppLimitsOptions> limits,
        ILogger<UploadDocumentCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
        _limits = limits.Value;
        _logger = logger;
    }

    public async Task<Result<DocumentDto>> Handle(UploadDocumentCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        if (_limits.DocumentUploadLimit >= 0)
        {
            var count = await _unitOfWork.Documents.CountByUserIdAsync(request.UserId, cancellationToken);
            if (count >= _limits.DocumentUploadLimit)
                return Result<DocumentDto>.Failure(
                    $"Upload limit of {_limits.DocumentUploadLimit} documents per account reached.",
                    "DOCUMENT_LIMIT_REACHED");
        }

        var blobFileName = $"{request.UserId}/{request.CourseId}/{Guid.NewGuid()}_{request.FileName}";
        string blobUrl;
        try
        {
            blobUrl = await _blobStorageService.UploadAsync(request.FileStream, blobFileName, request.ContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload document blob for course {CourseId} and user {UserId}", request.CourseId, request.UserId);
            return Result<DocumentDto>.Failure("Storage unavailable. Please try again later.", "STORAGE_ERROR");
        }

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = request.CourseId,
            UserId = request.UserId,
            FileName = request.FileName,
            BlobUrl = blobUrl,
            ContentType = request.ContentType,
            FileSize = request.FileSize,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = MapToDto(document);
        return Result<DocumentDto>.Success(dto, "Document uploaded successfully.");
    }

    private static DocumentDto MapToDto(Document doc) => new(
        doc.DocumentId,
        doc.CourseId,
        doc.UserId,
        doc.FileName,
        doc.BlobUrl,
        doc.ContentType,
        doc.FileSize,
        doc.Summary,
        doc.MindMapText,
        doc.CreatedAt,
        doc.UpdatedAt,
        doc.Transcript);
}
