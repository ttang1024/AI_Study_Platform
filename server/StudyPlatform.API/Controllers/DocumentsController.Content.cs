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

// AI content: quiz, flashcards, chat, notes, glossary & quiz submissions.
public partial class DocumentsController
{
    /// <summary>
    /// Generate quiz questions from a document
    /// </summary>
    [HttpPost("{documentId:guid}/quiz/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<QuizDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GenerateQuiz(Guid courseId, Guid documentId, [FromQuery] string difficulty = "medium")
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GenerateQuizCommand(documentId, userId, difficulty));
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
    public async Task<IActionResult> GetQuizzes(Guid courseId, Guid documentId, [FromQuery] string? difficulty = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentQuizzesQuery(documentId, userId, difficulty));
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
            _logger.LogWarning("Generate flashcards failed for document {DocumentId}: {ErrorCode} {Message}",
                documentId, result.ErrorCode, result.Message);
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

}
