using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Analytics.Commands;
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
    /// Get FSRS retention analytics: forgetting curve, predicted vs. actual recall, stability distribution
    /// </summary>
    [HttpGet("retention")]
    [ProducesResponseType(typeof(BaseResponse<RetentionAnalyticsDto>), 200)]
    public async Task<IActionResult> GetRetentionAnalytics()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetRetentionAnalyticsQuery(userId));
        return Ok(BaseResponse<RetentionAnalyticsDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Schedule vacation days so the study streak survives planned time off
    /// </summary>
    [HttpPost("vacation")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> SetVacation([FromBody] SetVacationRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SetVacationCommand(userId, request.StartDate, request.EndDate));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Cancel upcoming vacation days
    /// </summary>
    [HttpDelete("vacation")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> CancelVacation()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CancelVacationCommand(userId));
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

    /// <summary>
    /// How the learner's self-rated confidence compares to how right they actually were — in particular,
    /// the answers they were sure of and still got wrong.
    /// </summary>
    [HttpGet("calibration")]
    [ProducesResponseType(typeof(BaseResponse<QuizCalibrationDto>), 200)]
    public async Task<IActionResult> GetCalibration()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetQuizCalibrationQuery(userId));
        return Ok(BaseResponse<QuizCalibrationDto>.Ok(result.Data!));
    }

    /// <summary>
    /// This user's AI token spend, broken down by feature and model. Keys are the caller's own, so this
    /// is the only place the cost of their usage is visible to them.
    /// </summary>
    /// <param name="from">Inclusive start (UTC date). Defaults to 29 days before <paramref name="to"/>.</param>
    /// <param name="to">Inclusive end (UTC date). Defaults to today.</param>
    [HttpGet("ai-usage")]
    [ProducesResponseType(typeof(BaseResponse<AiUsageDto>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> GetAiUsage([FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAiUsageQuery(userId, from, to));

        return result.IsSuccess
            ? Ok(BaseResponse<AiUsageDto>.Ok(result.Data!))
            : BadRequest(result);
    }
}
