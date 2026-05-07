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
    /// For audio content, uses the stored transcript when available.
    private async Task<(byte[]? Bytes, string? Text)> GetDocumentContentAsync(
        Document document, CancellationToken cancellationToken)
    {
        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(document.Transcript))
                return (null, document.Transcript);

            if (AiInlineData.IsSupported(document.ContentType))
            {
                var audioStream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
                using var ms = new MemoryStream();
                await audioStream.CopyToAsync(ms, cancellationToken);
                return (ms.ToArray(), null);
            }

            return (null, string.Empty);
        }

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
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamMindMap(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        var fullText = new StringBuilder();
        IAsyncEnumerable<string> stream;

        try
        {
            var (bytes, text) = await GetDocumentContentAsync(document, cancellationToken);
            stream = bytes != null
                ? _aiService.StreamMindMapAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamMindMapAsync(text!, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        try
        {
            fullText.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
            {
                document.MindMapText = fullText.ToString();
                document.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Documents.Update(document);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    private async Task WriteSseDataAsync(string data, CancellationToken cancellationToken)
    {
        await Response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    private ObjectResult AiStreamError(Exception ex)
    {
        return AiErrorMapper.ToObjectResult(this, ex.Message);
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
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<QuizDto>>(this, result.Message);
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
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<FlashcardDto>>(this, result.Message);
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
    /// Delete AI chat history for a document
    /// </summary>
    [HttpDelete("{documentId:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteChatHistory(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        await _unitOfWork.ChatMessages.DeleteByDocumentIdAsync(documentId, userId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(BaseResponse<string>.Ok("Chat history deleted."));
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
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<GlossaryTermDto>>(this, result.Message);
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
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamSummary(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        var fullText = new StringBuilder();
        IAsyncEnumerable<string> stream;

        try
        {
            var (bytes, text) = await GetDocumentContentAsync(document, cancellationToken);
            stream = bytes != null
                ? _aiService.StreamSummaryAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamSummaryAsync(text!, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        try
        {
            fullText.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
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
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    /// <summary>
    /// Stream AI chat for a document (SSE), saves messages to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/chat/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamChat(Guid courseId, Guid documentId, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        var history = await _unitOfWork.ChatMessages.GetByDocumentIdAsync(documentId, userId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();
        string content;

        try
        {
            var (_, extractedContent) = await GetDocumentContentAsync(document, cancellationToken);
            content = extractedContent ?? string.Empty;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        var stream = _aiService.StreamChatAsync(content, request.Message, historyTuples, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            DocumentId = documentId,
            SourceType = "document",
            UserId = userId,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var fullResponse = new StringBuilder();
        try
        {
            fullResponse.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullResponse.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
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
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
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
