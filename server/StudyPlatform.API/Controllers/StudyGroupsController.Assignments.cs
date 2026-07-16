using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Group assignments: listing, posting, per-member completion, and deletion.
public partial class StudyGroupsController
{
    /// <summary>List the group's assignments with per-member completion.</summary>
    [HttpGet("{id:guid}/assignments")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<AssignmentDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetAssignments(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupAssignmentsQuery(userId, id));
        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<IReadOnlyList<AssignmentDto>>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<IReadOnlyList<AssignmentDto>>.Ok(result.Data!));
    }

    /// <summary>Post an assignment (group owner only).</summary>
    [HttpPost("{id:guid}/assignments")]
    [ProducesResponseType(typeof(BaseResponse<AssignmentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateAssignment(Guid id, [FromBody] CreateAssignmentRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateAssignmentCommand(
            userId, id, request.Title, request.Description, request.LinkUrl, request.DueAt));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<AssignmentDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<AssignmentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Mark an assignment complete/incomplete for the current member.</summary>
    [HttpPost("assignments/{assignmentId:guid}/completion")]
    [ProducesResponseType(typeof(BaseResponse<AssignmentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SetAssignmentCompletion(Guid assignmentId, [FromBody] SetAssignmentCompletionRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SetAssignmentCompletionCommand(userId, assignmentId, request.Completed));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<AssignmentDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<AssignmentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Delete an assignment (poster or group owner).</summary>
    [HttpDelete("assignments/{assignmentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> DeleteAssignment(Guid assignmentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteAssignmentCommand(userId, assignmentId));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record CreateAssignmentRequest(string Title, string? Description, string? LinkUrl, DateTime? DueAt);
public record SetAssignmentCompletionRequest(bool Completed);
