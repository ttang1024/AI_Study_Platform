using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Notes.DTOs;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/notes")]
[Authorize]
[Produces("application/json")]
public class NotesController : ControllerBase
{
    private readonly IMediator _mediator;

    public NotesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get all notes for the authenticated user (paginated)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<NoteDto>>), 200)]
    public async Task<IActionResult> GetAllNotes([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllNotesPagedQuery(userId, page, pageSize));
        return Ok(BaseResponse<PaginatedList<NoteDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a new global note
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<NoteDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateNote([FromBody] CreateNoteRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateNoteCommand(userId, request.Content, request.Title, request.DocumentId, request.VideoId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<NoteDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetAllNotes), BaseResponse<NoteDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Update a note
    /// </summary>
    [HttpPut("{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<NoteDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateNote(Guid noteId, [FromBody] UpdateNoteRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateNoteCommand(noteId, userId, request.Content, request.Title));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<NoteDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<NoteDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a note
    /// </summary>
    [HttpDelete("{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteNote(Guid noteId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteNoteCommand(noteId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Bulk delete notes
    /// </summary>
    [HttpDelete("bulk")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> BulkDeleteNotes([FromBody] BulkDeleteNotesRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new BulkDeleteNotesCommand(request.NoteIds, userId));
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

}
