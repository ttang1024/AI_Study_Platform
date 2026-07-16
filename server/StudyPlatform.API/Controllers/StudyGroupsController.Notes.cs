using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Collaborative notes shared within a group (CRDT-backed editor state).
public partial class StudyGroupsController
{
    /// <summary>List the group's shared notes.</summary>
    [HttpGet("{groupId:guid}/notes")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<GroupNoteSummaryDto>>), 200)]
    public async Task<IActionResult> GetGroupNotes(Guid groupId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupNotesQuery(groupId, userId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<IReadOnlyList<GroupNoteSummaryDto>>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<IReadOnlyList<GroupNoteSummaryDto>>.Ok(result.Data!));
    }

    /// <summary>Fetch one shared note incl. its CRDT state for the editor.</summary>
    [HttpGet("notes/{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<GroupNoteDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GetGroupNote(Guid noteId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupNoteQuery(noteId, userId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<GroupNoteDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<GroupNoteDto>.Ok(result.Data!));
    }

    /// <summary>Create a shared note in the group.</summary>
    [HttpPost("{groupId:guid}/notes")]
    [ProducesResponseType(typeof(BaseResponse<GroupNoteSummaryDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateGroupNote(Guid groupId, [FromBody] CreateGroupNoteRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateGroupNoteCommand(groupId, userId, request.Title));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<GroupNoteSummaryDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<GroupNoteSummaryDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Delete a shared note (creator or group owner).</summary>
    [HttpDelete("notes/{noteId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> DeleteGroupNote(Guid noteId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteGroupNoteCommand(noteId, userId));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
