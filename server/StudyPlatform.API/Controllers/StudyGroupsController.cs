using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/study-groups")]
[Authorize]
[Produces("application/json")]
public class StudyGroupsController : ControllerBase
{
    private readonly IMediator _mediator;

    public StudyGroupsController(IMediator mediator)
    {
        _mediator = mediator;
    }

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

        return Ok(BaseResponse<StudyGroupDto>.Ok(result.Data!, result.Message));
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

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Share a course with a study group
    /// </summary>
    [HttpPost("{id:guid}/share-course")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ShareCourseWithGroup(Guid id, [FromBody] ShareCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ShareCourseWithGroupCommand(userId, id, request.CourseId));

        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Remove a shared course from a study group
    /// </summary>
    [HttpDelete("{id:guid}/shared-courses/{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RemoveSharedCourse(Guid id, Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RemoveSharedCourseCommand(userId, id, courseId));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "NOT_FOUND")
                return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        }

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Get chat messages for a study group
    /// </summary>
    [HttpGet("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<GroupChatMessageDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetGroupChat(Guid id, [FromQuery] int page = 1)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupChatQuery(userId, id, page));

        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<IEnumerable<GroupChatMessageDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<GroupChatMessageDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Send a chat message to a study group
    /// </summary>
    [HttpPost("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<GroupChatMessageDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> SendGroupChatMessage(Guid id, [FromBody] SendGroupChatMessageRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SendGroupChatMessageCommand(userId, id, request.Content));

        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<GroupChatMessageDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<GroupChatMessageDto>.Ok(result.Data!, result.Message));
    }
}

public record CreateStudyGroupRequest(string Name, string? Description);
public record JoinStudyGroupRequest(string InviteCode);
public record ShareCourseRequest(Guid CourseId);
public record SendGroupChatMessageRequest(string Content);
