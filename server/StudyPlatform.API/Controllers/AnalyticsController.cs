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

    /// <summary>
    /// Record a slice of active study time (heartbeat from a study surface)
    /// </summary>
    [HttpPost("study-session")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> RecordStudySession([FromBody] RecordStudySessionRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RecordStudySessionCommand(
            userId, request.CourseId, request.ContextType, request.ContextId, request.DurationSeconds));
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Get time-on-task (daily series + per-course totals) for a date range
    /// </summary>
    [HttpGet("time-on-task")]
    [ProducesResponseType(typeof(BaseResponse<TimeOnTaskDto>), 200)]
    public async Task<IActionResult> GetTimeOnTask(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var userId = User.GetUserId();
        var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
        var toDate = to ?? DateTime.UtcNow;

        var result = await _mediator.Send(new GetTimeOnTaskQuery(userId, fromDate, toDate));
        return Ok(BaseResponse<TimeOnTaskDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get the dashboard at-a-glance summary: study streak, today's time, due flashcards, and reinforcement counts
    /// </summary>
    [HttpGet("dashboard-summary")]
    [ProducesResponseType(typeof(BaseResponse<DashboardSummaryDto>), 200)]
    public async Task<IActionResult> GetDashboardSummary()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDashboardSummaryQuery(userId));
        return Ok(BaseResponse<DashboardSummaryDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Update the user's daily study-time goal (minutes)
    /// </summary>
    [HttpPut("daily-goal")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> UpdateDailyGoal([FromBody] UpdateDailyGoalRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateDailyGoalCommand(userId, request.Minutes));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Get topic mastery scores per course
    /// </summary>
    [HttpGet("course-mastery")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<CourseMasteryDto>>), 200)]
    public async Task<IActionResult> GetCourseMastery()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetCourseMasteryQuery(userId));
        return Ok(BaseResponse<IEnumerable<CourseMasteryDto>>.Ok(result.Data!));
    }
}
