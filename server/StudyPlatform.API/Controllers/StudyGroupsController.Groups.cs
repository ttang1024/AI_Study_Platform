using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Group lifecycle (create/detail/delete) and membership (join/leave/remove).
public partial class StudyGroupsController
{
    /// <summary>
    /// Get all study groups the user belongs to
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<StudyGroupDto>>), 200)]
    public async Task<IActionResult> GetMyGroups()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetMyGroupsQuery(userId));
        return Ok(BaseResponse<IEnumerable<StudyGroupDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a new study group
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<StudyGroupDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateStudyGroup([FromBody] CreateStudyGroupRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateStudyGroupCommand(userId, request.Name, request.Description));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<StudyGroupDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetGroupDetail), new { id = result.Data!.StudyGroupId },
            BaseResponse<StudyGroupDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get a study group's detail including members and shared courses
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<StudyGroupDetailDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetGroupDetail(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupDetailQuery(userId, id));

        if (!result.IsSuccess)
            return NotFound(BaseResponse<StudyGroupDetailDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<StudyGroupDetailDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Join a study group using an invite code
    /// </summary>
    [HttpPost("join")]
    [ProducesResponseType(typeof(BaseResponse<StudyGroupDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> JoinStudyGroup([FromBody] JoinStudyGroupRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new JoinStudyGroupCommand(userId, request.InviteCode));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<StudyGroupDto>.Fail(result.Message, result.ErrorCode));

        var groupId = result.Data!.Group.StudyGroupId.ToString();
        await _hubContext.Clients.Group(groupId).SendAsync("MemberJoined", result.Data.Member);

        return Ok(BaseResponse<StudyGroupDto>.Ok(result.Data.Group, result.Message));
    }

    /// <summary>
    /// Leave a study group
    /// </summary>
    [HttpDelete("{id:guid}/leave")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> LeaveStudyGroup(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new LeaveStudyGroupCommand(userId, id));

        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        await _hubContext.Clients.Group(id.ToString()).SendAsync("MemberLeft", userId);

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Remove a member from a study group (owner only)
    /// </summary>
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RemoveGroupMember(Guid id, Guid userId)
    {
        var ownerId = User.GetUserId();
        var result = await _mediator.Send(new RemoveGroupMemberCommand(ownerId, id, userId));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "NOT_FOUND")
                return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
            return StatusCode(403, new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        }

        await _hubContext.Clients.Group(id.ToString()).SendAsync("MemberRemoved", userId);

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Delete a study group (owner only)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteStudyGroup(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteStudyGroupCommand(userId, id));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "NOT_FOUND")
                return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
            return StatusCode(403, new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        }

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record CreateStudyGroupRequest(string Name, string? Description);
public record JoinStudyGroupRequest(string InviteCode);
