using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;

namespace StudyPlatform.API.Controllers;

// Document CRUD: list, get, upload, delete, update, move, file download.
public partial class DocumentsController
{

    /// <summary>
    /// Get all documents in a course
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<DocumentDto>>), 200)]
    public async Task<IActionResult> GetDocuments(Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentsByCourseQuery(courseId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<DocumentDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<DocumentDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get a document by ID
    /// </summary>
    [HttpGet("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetDocument(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Upload a document to a course
    /// </summary>
    [HttpPost("upload")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [RequestSizeLimit(52428800)] // 50MB
    public async Task<IActionResult> UploadDocument(Guid courseId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<DocumentDto>.Fail("No file provided.", "NO_FILE"));

        var allowedTypes = new[]
        {
            // Text / office documents
            "application/pdf", "text/plain", "text/markdown", "text/x-markdown",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            // PowerPoint
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            // eBook
            "application/epub+zip",
            // Images
            "image/png", "image/jpeg", "image/jpg", "image/gif",
            "image/webp", "image/heic", "image/heif", "image/bmp",
            // Some browsers/OSes send a generic type for .pptx/.epub uploads;
            // accept these and rely on the extension allowlist below.
            "application/zip", "application/octet-stream",
        };

        var allowedExtensions = new[]
        {
            ".pdf", ".txt", ".md", ".markdown", ".doc", ".docx",
            ".ppt", ".pptx", ".epub",
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".heif", ".bmp",
        };

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedTypes.Contains(file.ContentType) || !allowedExtensions.Contains(extension))
            return BadRequest(BaseResponse<DocumentDto>.Fail(
                "File type not supported. Allowed: PDF, Image, PPT, Word, TXT, Markdown, eBook (EPUB).",
                "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadDocumentCommand(
            courseId, userId, file.FileName, file.ContentType, file.Length, stream));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "STORAGE_ERROR")
                return StatusCode(StatusCodes.Status503ServiceUnavailable, BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
            if (result.ErrorCode == "DUPLICATE_DOCUMENT")
                return Conflict(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
        }

        return CreatedAtAction(nameof(GetDocument), new { courseId, documentId = result.Data!.DocumentId },
            BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a document
    /// </summary>
    [HttpDelete("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteDocument(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteDocumentCommand(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Update document metadata
    /// </summary>
    [HttpPatch("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateDocument(Guid courseId, Guid documentId, [FromBody] UpdateDocumentRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateDocumentCommand(documentId, userId, request.FileName));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Move a document to a different course
    /// </summary>
    [HttpPatch("{documentId:guid}/move")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> MoveDocument(Guid courseId, Guid documentId, [FromBody] MoveCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new MoveDocumentCommand(documentId, userId, request.TargetCourseId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Stream the raw file content for a document (used by the viewer)
    /// </summary>
    [HttpGet("{documentId:guid}/file")]
    [Produces("application/octet-stream")]
    public async Task<IActionResult> GetDocumentFile(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound();

        var stream = await _blobStorageService.DownloadAsync(result.Data!.BlobUrl);
        return File(stream, result.Data!.ContentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// Get the extracted plain-text content for a document (used by the viewer for
    /// formats that cannot be rendered in the browser, e.g. PPTX and EPUB).
    /// </summary>
    [HttpGet("{documentId:guid}/text")]
    [Produces("text/plain")]
    public async Task<IActionResult> GetDocumentText(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound();

        var (_, text) = await _contentService.GetContentAsync(document, cancellationToken);
        return Content(text ?? string.Empty, "text/plain; charset=utf-8");
    }

}
