using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyQueue.DTOs;
using StudyPlatform.Application.StudyQueue.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/recommendations")]
[Authorize]
[Produces("application/json")]
public class RecommendationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public RecommendationsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get a personalized review queue and next-best-content suggestions based on weak areas
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<RecommendationsDto>), 200)]
    public async Task<IActionResult> GetRecommendations()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetRecommendationsQuery(userId));
        return Ok(BaseResponse<RecommendationsDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get today's study plan: streak/goal progress plus one ordered, time-budgeted to-do list
    /// blending the review queue and top knowledge gaps
    /// </summary>
    [HttpGet("today")]
    [ProducesResponseType(typeof(BaseResponse<TodayPlanDto>), 200)]
    public async Task<IActionResult> GetTodayPlan()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetTodayPlanQuery(userId));
        return Ok(BaseResponse<TodayPlanDto>.Ok(result.Data!));
    }
}
