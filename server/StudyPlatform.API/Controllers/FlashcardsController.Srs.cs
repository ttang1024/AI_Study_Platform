using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Flashcards.DTOs;

namespace StudyPlatform.API.Controllers;

public record UndoReviewRequest(Guid? FlashcardId = null);

/// <summary>
/// Scheduler tuning: the knobs and the optimizer behind how FSRS picks intervals for this user.
/// </summary>
public partial class FlashcardsController
{
    /// <summary>
    /// Get the user's FSRS scheduler settings, plus whether they have enough history to optimize
    /// </summary>
    [HttpGet("srs/settings")]
    [ProducesResponseType(typeof(BaseResponse<FsrsSettingsDto>), 200)]
    public async Task<IActionResult> GetFsrsSettings()
    {
        var result = await _mediator.Send(new GetFsrsSettingsQuery(User.GetUserId()));
        return Ok(BaseResponse<FsrsSettingsDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Update FSRS scheduler settings (desired retention, maximum interval, interval fuzz)
    /// </summary>
    [HttpPut("srs/settings")]
    [ProducesResponseType(typeof(BaseResponse<FsrsSettingsDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> UpdateFsrsSettings([FromBody] UpdateFsrsSettingsRequest request)
    {
        var result = await _mediator.Send(new UpdateFsrsSettingsCommand(
            User.GetUserId(), request.DesiredRetention, request.MaximumIntervalDays, request.EnableFuzz,
            request.NewCardsPerDay, request.MaxReviewsPerDay));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<FsrsSettingsDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<FsrsSettingsDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Fit the FSRS weights to the user's own review history, adopting them if better calibrated
    /// </summary>
    [HttpPost("srs/optimize")]
    [ProducesResponseType(typeof(BaseResponse<FsrsOptimizationDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> OptimizeFsrsWeights()
    {
        var result = await _mediator.Send(new OptimizeFsrsWeightsCommand(User.GetUserId()));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<FsrsOptimizationDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<FsrsOptimizationDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Discard fitted weights and go back to the stock FSRS-4.5 scheduler
    /// </summary>
    [HttpPost("srs/weights/reset")]
    [ProducesResponseType(typeof(BaseResponse<FsrsSettingsDto>), 200)]
    public async Task<IActionResult> ResetFsrsWeights()
    {
        var result = await _mediator.Send(new ResetFsrsWeightsCommand(User.GetUserId()));
        return Ok(BaseResponse<FsrsSettingsDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Upcoming review load per day, plus the overdue backlog
    /// </summary>
    [HttpGet("srs/forecast")]
    [ProducesResponseType(typeof(BaseResponse<ReviewForecastDto>), 200)]
    public async Task<IActionResult> GetReviewForecast([FromQuery] int days = GetReviewForecastQuery.DefaultDays)
    {
        var result = await _mediator.Send(new GetReviewForecastQuery(User.GetUserId(), days));
        return Ok(BaseResponse<ReviewForecastDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Spread overdue cards across the coming days so a backlog is workable again
    /// </summary>
    [HttpPost("srs/reschedule-backlog")]
    [ProducesResponseType(typeof(BaseResponse<RescheduleBacklogDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RescheduleBacklog([FromBody] RescheduleBacklogRequest? request = null)
    {
        var result = await _mediator.Send(new RescheduleBacklogCommand(
            User.GetUserId(), request?.Days ?? RescheduleBacklogDefaults.Days));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<RescheduleBacklogDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<RescheduleBacklogDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Undo the most recent review, restoring the card's scheduling to exactly what it was
    /// </summary>
    [HttpPost("review/undo")]
    [ProducesResponseType(typeof(BaseResponse<UndoReviewDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> UndoLastReview([FromBody] UndoReviewRequest? request = null)
    {
        var result = await _mediator.Send(new UndoLastReviewCommand(User.GetUserId(), request?.FlashcardId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<UndoReviewDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<UndoReviewDto>.Ok(result.Data!, result.Message));
    }
}
