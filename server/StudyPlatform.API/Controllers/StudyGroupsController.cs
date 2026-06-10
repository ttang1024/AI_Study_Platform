using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Hubs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/study-groups")]
[Authorize]
[Produces("application/json")]
public class StudyGroupsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IHubContext<GroupChatHub> _hubContext;

    public StudyGroupsController(IMediator mediator, IHubContext<GroupChatHub> hubContext)
    {
        _mediator = mediator;
        _hubContext = hubContext;
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

    /// <summary>
    /// Share a course with a study group
    /// </summary>
    [HttpPost("{id:guid}/share-course")]
    [ProducesResponseType(typeof(BaseResponse<SharedCourseDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ShareCourseWithGroup(Guid id, [FromBody] ShareCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ShareCourseWithGroupCommand(userId, id, request.CourseId));

        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        await _hubContext.Clients.Group(id.ToString()).SendAsync("CourseShared", result.Data!);

        return Ok(BaseResponse<SharedCourseDto>.Ok(result.Data!, result.Message));
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

        await _hubContext.Clients.Group(id.ToString()).SendAsync("CourseUnshared", courseId);

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

    // ── Leaderboard ──────────────────────────────────────────────────────────

    /// <summary>Weekly XP leaderboard for the group's members.</summary>
    [HttpGet("{id:guid}/leaderboard")]
    [ProducesResponseType(typeof(BaseResponse<GroupLeaderboardDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetLeaderboard(Guid id, [FromQuery] int days = 7)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupLeaderboardQuery(id, userId, days));
        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<GroupLeaderboardDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<GroupLeaderboardDto>.Ok(result.Data!));
    }

    // ── Quiz battles ─────────────────────────────────────────────────────────

    /// <summary>List the group's quiz battles with standings.</summary>
    [HttpGet("{id:guid}/battles")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<BattleDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetBattles(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupBattlesQuery(userId, id));
        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<IReadOnlyList<BattleDto>>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<IReadOnlyList<BattleDto>>.Ok(result.Data!));
    }

    /// <summary>Create a quiz battle from the creator's quiz bank (optionally one course).</summary>
    [HttpPost("{id:guid}/battles")]
    [ProducesResponseType(typeof(BaseResponse<BattleDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateBattle(Guid id, [FromBody] CreateBattleRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateBattleCommand(userId, id, request.Title, request.CourseId, request.Count));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<BattleDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<BattleDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Get a battle's questions to play it (correct answers stay server-side).</summary>
    [HttpGet("battles/{battleId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<BattlePlayDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetBattle(Guid battleId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetBattlePlayQuery(userId, battleId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<BattlePlayDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<BattlePlayDto>.Ok(result.Data!));
    }

    /// <summary>Submit battle answers; returns the graded run and updated standings.</summary>
    [HttpPost("battles/{battleId:guid}/entries")]
    [ProducesResponseType(typeof(BaseResponse<BattleResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SubmitBattleEntry(Guid battleId, [FromBody] SubmitBattleEntryRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SubmitBattleEntryCommand(userId, battleId, request.Answers, request.DurationSeconds));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<BattleResultDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<BattleResultDto>.Ok(result.Data!));
    }

    // ── Assignments ──────────────────────────────────────────────────────────

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

public record CreateStudyGroupRequest(string Name, string? Description);
public record JoinStudyGroupRequest(string InviteCode);
public record ShareCourseRequest(Guid CourseId);
public record SendGroupChatMessageRequest(string Content);
public record CreateBattleRequest(string Title, Guid? CourseId, int Count);
public record SubmitBattleEntryRequest(Dictionary<string, string> Answers, int DurationSeconds);
public record CreateAssignmentRequest(string Title, string? Description, string? LinkUrl, DateTime? DueAt);
public record SetAssignmentCompletionRequest(bool Completed);
