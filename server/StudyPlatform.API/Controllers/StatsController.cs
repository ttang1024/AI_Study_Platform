using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Application.Stats;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/stats")]
[Authorize]
[Produces("application/json")]
public class StatsController : ControllerBase
{
    private readonly IMediator _mediator;

    public StatsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get aggregate counts for the authenticated user
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<UserStatsDto>), 200)]
    public async Task<IActionResult> GetStats()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetUserStatsQuery(userId));
        return Ok(BaseResponse<UserStatsDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Lifetime XP and level, derived from study time, quiz correctness, reviews and mastery.
    /// </summary>
    [HttpGet("xp")]
    [ProducesResponseType(typeof(BaseResponse<UserXpDto>), 200)]
    public async Task<IActionResult> GetXp()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetUserXpQuery(userId));
        return Ok(BaseResponse<UserXpDto>.Ok(result.Data!));
    }
}
