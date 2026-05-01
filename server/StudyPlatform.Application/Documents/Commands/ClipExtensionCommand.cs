using System.Text;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record ClipExtensionCommand(
    Guid UserId,
    string Url,
    string Title,
    string Content,
    Guid? CourseId) : IRequest<Result<DocumentDto>>;

public class ClipExtensionCommandHandler : IRequestHandler<ClipExtensionCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public ClipExtensionCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<DocumentDto>> Handle(ClipExtensionCommand request, CancellationToken cancellationToken)
    {
        // Resolve course: use provided CourseId or find/create a default "Clipped Pages" course
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
            // Find or create a default "Clipped Pages" course for the user
            var courses = await _unitOfWork.Courses.GetByUserIdAsync(request.UserId, cancellationToken);
            var defaultCourse = courses.FirstOrDefault(c => c.CourseName == "Clipped Pages");
            if (defaultCourse == null)
            {
                defaultCourse = new Course
                {
                    CourseId = Guid.NewGuid(),
                    UserId = request.UserId,
                    CourseName = "Clipped Pages",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.Courses.AddAsync(defaultCourse, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
            courseId = defaultCourse.CourseId;
        }

        // Store content as plain text blob
        var contentBytes = Encoding.UTF8.GetBytes(request.Content);
        var safeTitle = string.Concat(request.Title.Take(80)).Replace("/", "-").Replace("\\", "-");
        var fileName = $"{safeTitle}.txt";
        var blobFileName = $"{request.UserId}/{courseId}/{Guid.NewGuid()}_{fileName}";

        string blobUrl;
        try
        {
            using var stream = new MemoryStream(contentBytes);
            blobUrl = await _blobStorageService.UploadAsync(stream, blobFileName, "text/plain", cancellationToken);
        }
        catch (Exception ex)
        {
            return Result<DocumentDto>.Failure($"Storage unavailable: {ex.Message}", "STORAGE_ERROR");
        }

        var document = new Document
        {
            DocumentId = Guid.NewGuid(),
            CourseId = courseId,
            UserId = request.UserId,
            FileName = fileName,
            BlobUrl = blobUrl,
            ContentType = "text/plain",
            FileSize = contentBytes.Length,
            OriginalUrl = request.Url,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Documents.AddAsync(document, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(MapToDto(document), "Page clipped successfully.");
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
        OriginalUrl: doc.OriginalUrl);
}
