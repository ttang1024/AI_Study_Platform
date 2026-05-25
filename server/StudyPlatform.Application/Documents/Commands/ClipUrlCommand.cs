using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record ClipUrlCommand(
    Guid CourseId,
    Guid UserId,
    string FileName,
    Stream ContentStream,
    long ContentLength,
    string ContentType,
    string? OriginalUrl = null) : IRequest<Result<DocumentDto>>;

public class ClipUrlCommandHandler : IRequestHandler<ClipUrlCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public ClipUrlCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<DocumentDto>> Handle(ClipUrlCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        var blobFileName = $"{request.UserId}/{request.CourseId}/{Guid.NewGuid()}_{request.FileName}";
        string blobUrl;
        try
        {
            blobUrl = await _blobStorageService.UploadAsync(request.ContentStream, blobFileName, request.ContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            return Result<DocumentDto>.Failure($"Storage unavailable: {ex.Message}", "STORAGE_ERROR");
        }

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = request.CourseId,
            UserId = request.UserId,
            FileName = request.FileName,
            BlobUrl = blobUrl,
            ContentType = request.ContentType,
            FileSize = request.ContentLength,
            OriginalUrl = request.OriginalUrl,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(MapToDto(document), "Article clipped successfully.");
    }

    private static DocumentDto MapToDto(Document doc) => new(
        doc.DocumentId,
        doc.CourseId,
        doc.UserId,
        doc.FileName,
        doc.BlobUrl,
        doc.ContentType,
        doc.FileSize,
        doc.FileHash,
        doc.Summary,
        doc.MindMapText,
        doc.CreatedAt,
        doc.UpdatedAt,
        OriginalUrl: doc.OriginalUrl);
}
