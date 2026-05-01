using System.Text;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record OcrImageCommand(
    Guid UserId,
    Guid? CourseId,
    byte[] ImageData,
    string ContentType,
    string FileName) : IRequest<Result<DocumentDto>>;

public class OcrImageCommandHandler : IRequestHandler<OcrImageCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IBlobStorageService _blobStorageService;

    public OcrImageCommandHandler(IUnitOfWork unitOfWork, IAiService aiService, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<DocumentDto>> Handle(OcrImageCommand request, CancellationToken cancellationToken)
    {
        // Determine target course
        Guid courseId;
        if (request.CourseId.HasValue)
        {
            var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId.Value, cancellationToken);
            if (course == null || course.UserId != request.UserId)
                return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");
            courseId = request.CourseId.Value;
        }
        else
        {
            // Use first available course or fail
            var courses = await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken);
            var firstCourse = courses.FirstOrDefault();
            if (firstCourse == null)
                return Result<DocumentDto>.Failure("No courses found. Please create a course first.", "NO_COURSE");
            courseId = firstCourse.CourseId;
        }

        // Extract text from image
        var extractedText = await _aiService.ExtractTextFromImageAsync(request.ImageData, request.ContentType, cancellationToken);

        // Store the extracted text as a .txt document in blob storage
        var textBytes = Encoding.UTF8.GetBytes(extractedText);
        using var stream = new MemoryStream(textBytes);
        var blobFileName = $"{request.UserId}/{courseId}/{Guid.NewGuid()}_{request.FileName}.txt";
        var blobUrl = await _blobStorageService.UploadAsync(stream, blobFileName, "text/plain", cancellationToken);

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = courseId,
            UserId = request.UserId,
            FileName = request.FileName + " (OCR)",
            BlobUrl = blobUrl,
            ContentType = "text/plain",
            FileSize = textBytes.Length,
            Transcript = extractedText,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(MapToDto(document), "Text extracted from image successfully.");
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
