using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/documents")]
[Authorize]
[Produces("application/json")]
public class DocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IAiService _aiService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentTextExtractor _textExtractor;

    public DocumentsController(
        IMediator mediator,
        IBlobStorageService blobStorageService,
        IAiService aiService,
        IUnitOfWork unitOfWork,
        IDocumentTextExtractor textExtractor)
    {
        _mediator = mediator;
        _blobStorageService = blobStorageService;
        _aiService = aiService;
        _unitOfWork = unitOfWork;
        _textExtractor = textExtractor;
    }

    /// Returns (bytes, null) for inline-capable types, (null, text) for text-based types.
    /// For audio/podcast the transcript is used as the text content.
    private async Task<(byte[]? Bytes, string? Text)> GetDocumentContentAsync(
        Document document, CancellationToken cancellationToken)
    {
        if (document.ContentType == "audio/podcast")
            return (null, document.Transcript ?? string.Empty);

        if (AiInlineData.IsSupported(document.ContentType))
        {
            var blobStream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
            using var ms = new MemoryStream();
            await blobStream.CopyToAsync(ms, cancellationToken);
            return (ms.ToArray(), null);
        }

        var text = await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
        return (null, text);
    }

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

        var allowedTypes = new[] { "application/pdf", "text/plain", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/markdown", "text/x-markdown" };

        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(BaseResponse<DocumentDto>.Fail("File type not supported. Allowed: PDF, TXT, DOCX, MD.", "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadDocumentCommand(
            courseId, userId, file.FileName, file.ContentType, file.Length, stream));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "STORAGE_ERROR")
                return StatusCode(StatusCodes.Status503ServiceUnavailable, BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

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
    /// Stream mind map for a document (SSE), saves result to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/mindmap/stream")]
    public async Task StreamMindMap(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
        {
            Response.StatusCode = 404;
            return;
        }

        var fullText = new StringBuilder();
        try
        {
            var (bytes, text) = await GetDocumentContentAsync(document, cancellationToken);
            var stream = bytes != null
                ? _aiService.StreamMindMapAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamMindMapAsync(text!, cancellationToken);

            await foreach (var chunk in stream)
            {
                fullText.Append(chunk);
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(chunk)}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            if (fullText.Length > 0)
            {
                document.MindMapText = fullText.ToString();
                document.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Documents.Update(document);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex)
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize("[ERROR] " + ex.Message)}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    /// <summary>
    /// Generate quiz questions from a document
    /// </summary>
    [HttpPost("{documentId:guid}/quiz/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<QuizDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GenerateQuiz(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GenerateQuizCommand(documentId, userId));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<IEnumerable<QuizDto>>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get quizzes for a document
    /// </summary>
    [HttpGet("{documentId:guid}/quiz")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<QuizDto>>), 200)]
    public async Task<IActionResult> GetQuizzes(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentQuizzesQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Generate flashcards from a document
    /// </summary>
    [HttpPost("{documentId:guid}/flashcards/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<FlashcardDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GenerateFlashcards(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GenerateFlashcardsCommand(documentId, userId));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<IEnumerable<FlashcardDto>>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get flashcards for a document
    /// </summary>
    [HttpGet("{documentId:guid}/flashcards")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<FlashcardDto>>), 200)]
    public async Task<IActionResult> GetDocumentFlashcards(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentFlashcardsQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Chat with AI about a document
    /// </summary>
    [HttpPost("{documentId:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<ChatMessageDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> AiChat(Guid courseId, Guid documentId, [FromBody] AIChatRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new AIChatCommand(documentId, userId, request.Message));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<ChatMessageDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<ChatMessageDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get AI chat history for a document
    /// </summary>
    [HttpGet("{documentId:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    public async Task<IActionResult> GetChatHistory(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAIChatHistoryQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<ChatMessageDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get notes for a document
    /// </summary>
    [HttpGet("{documentId:guid}/notes")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<NoteDto>>), 200)]
    public async Task<IActionResult> GetDocumentNotes(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentNotesQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<NoteDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<NoteDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a note for a document
    /// </summary>
    [HttpPost("{documentId:guid}/notes")]
    [ProducesResponseType(typeof(BaseResponse<NoteDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateDocumentNote(Guid courseId, Guid documentId, [FromBody] CreateNoteRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateNoteCommand(userId, request.Content, request.Title, documentId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<NoteDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetDocumentNotes), new { courseId, documentId },
            BaseResponse<NoteDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Update a document note
    /// </summary>
    [HttpPut("{documentId:guid}/notes/{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<NoteDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateDocumentNote(Guid courseId, Guid documentId, Guid noteId, [FromBody] UpdateNoteRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateNoteCommand(noteId, userId, request.Content, request.Title));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<NoteDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<NoteDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a document note
    /// </summary>
    [HttpDelete("{documentId:guid}/notes/{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteDocumentNote(Guid courseId, Guid documentId, Guid noteId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteNoteCommand(noteId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Save the user's quiz submission (answers + score) for a document
    /// </summary>
    [HttpPost("{documentId:guid}/quiz/submission")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> SaveQuizSubmission(Guid courseId, Guid documentId, [FromBody] SaveQuizSubmissionRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SaveQuizSubmissionCommand(documentId, userId, request.Answers, request.Score, request.Total));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<QuizSubmissionDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<QuizSubmissionDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get glossary terms for a document
    /// </summary>
    [HttpGet("{documentId:guid}/glossary")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<GlossaryTermDto>>), 200)]
    public async Task<IActionResult> GetGlossaryTerms(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGlossaryTermsQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Generate glossary terms from a document
    /// </summary>
    [HttpPost("{documentId:guid}/glossary/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<GlossaryTermDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GenerateGlossary(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GenerateGlossaryCommand(documentId, userId));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get the user's saved quiz submission for a document
    /// </summary>
    [HttpGet("{documentId:guid}/quiz/submission")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> GetQuizSubmission(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetQuizSubmissionQuery(documentId, userId));
        return Ok(BaseResponse<QuizSubmissionDto?>.Ok(result.Data));
    }

    /// <summary>
    /// Stream AI summary for a document (SSE), saves result to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/summary/stream")]
    public async Task StreamSummary(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
        {
            Response.StatusCode = 404;
            return;
        }

        var fullText = new StringBuilder();
        try
        {
            var (bytes, text) = await GetDocumentContentAsync(document, cancellationToken);
            var stream = bytes != null
                ? _aiService.StreamSummaryAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamSummaryAsync(text!, cancellationToken);

            await foreach (var chunk in stream)
            {
                fullText.Append(chunk);
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(chunk)}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            // Persist the streamed summary
            if (fullText.Length > 0)
            {
                document.Summary = fullText.ToString();
                document.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Documents.Update(document);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex)
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize("[ERROR] " + ex.Message)}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    /// <summary>
    /// Stream AI chat for a document (SSE), saves messages to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/chat/stream")]
    public async Task StreamChat(Guid courseId, Guid documentId, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
        {
            Response.StatusCode = 404;
            return;
        }

        var history = await _unitOfWork.ChatMessages.GetByDocumentIdAsync(documentId, userId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();
        var (_, content) = await GetDocumentContentAsync(document, cancellationToken);
        content ??= string.Empty;

        // Save user message
        var userMsg = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            DocumentId = documentId,
            SourceType = "document",
            UserId = userId,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTime.UtcNow
        };
        await _unitOfWork.ChatMessages.AddAsync(userMsg, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var fullResponse = new StringBuilder();
        try
        {
            await foreach (var chunk in _aiService.StreamChatAsync(content, request.Message, historyTuples, cancellationToken))
            {
                fullResponse.Append(chunk);
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(chunk)}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            // Save model message
            if (fullResponse.Length > 0)
            {
                var assistantMsg = new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    DocumentId = documentId,
                    SourceType = "document",
                    UserId = userId,
                    Role = "assistant",
                    Content = fullResponse.ToString(),
                    CreatedAt = DateTime.UtcNow
                };
                await _unitOfWork.ChatMessages.AddAsync(assistantMsg, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex)
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize("[ERROR] " + ex.Message)}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}

/// <summary>
/// Standalone endpoint for browser extension clipping (not scoped to a course route).
/// </summary>
[ApiController]
[Authorize]
[Produces("application/json")]
public class DocumentExtensionController : ControllerBase
{
    private readonly IMediator _mediator;

    public DocumentExtensionController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Clip a web page from the browser extension
    /// </summary>
    [HttpPost("api/documents/clip-extension")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ClipExtension([FromBody] ClipExtensionRequest request)
    {
        var userId = User.GetUserId();

        Guid? courseId = null;
        if (!string.IsNullOrWhiteSpace(request.CourseId) && Guid.TryParse(request.CourseId, out var parsedCourseId))
            courseId = parsedCourseId;

        var result = await _mediator.Send(new ClipExtensionCommand(userId, request.Url, request.Title, request.Content, courseId));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }
}

public record ClipExtensionRequest(string Url, string Title, string Content, string? CourseId = null);
