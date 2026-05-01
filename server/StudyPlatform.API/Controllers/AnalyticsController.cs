using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
[Produces("application/json")]
public class AnalyticsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AnalyticsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get daily quiz accuracy for a date range
    /// </summary>
    [HttpGet("quiz-accuracy")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<DailyQuizAccuracyDto>>), 200)]
    public async Task<IActionResult> GetDailyQuizAccuracy(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var userId = User.GetUserId();
        var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
        var toDate = to ?? DateTime.UtcNow;

        var result = await _mediator.Send(new GetDailyQuizAccuracyQuery(userId, fromDate, toDate));
        return Ok(BaseResponse<IEnumerable<DailyQuizAccuracyDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Record a quiz attempt for analytics
    /// </summary>
    [HttpPost("quiz-attempt")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> RecordQuizAttempt([FromBody] RecordQuizAttemptRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RecordQuizAttemptCommand(userId, request.QuizId, request.IsCorrect));
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
