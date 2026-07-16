using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Competitive features for a group: the weekly XP leaderboard and quiz battles.
public partial class StudyGroupsController
{
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
}

public record CreateBattleRequest(string Title, Guid? CourseId, int Count);
public record SubmitBattleEntryRequest(Dictionary<string, string> Answers, int DurationSeconds);
