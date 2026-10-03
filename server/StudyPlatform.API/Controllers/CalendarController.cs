using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Calendar;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly IMediator _mediator;

    public CalendarController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Download an iCalendar (.ics) file with upcoming flashcard due-counts, study blocks and exam dates.
    /// </summary>
    [HttpGet("ics")]
    [Produces("text/calendar")]
    public async Task<IActionResult> GetIcsFeed()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetCalendarFeedQuery(userId));
        return File(System.Text.Encoding.UTF8.GetBytes(result.Data!), "text/calendar", "easy-study.ics");
    }

    /// <summary>
    /// List connected external calendars (ICS feeds)
    /// </summary>
    [HttpGet("feeds")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<CalendarFeedDto>>), 200)]
    public async Task<IActionResult> GetFeeds()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetCalendarFeedsQuery(userId));
        return Ok(BaseResponse<IReadOnlyList<CalendarFeedDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Connect an external calendar by its ICS ("secret address") URL
    /// </summary>
    [HttpPost("feeds")]
    [ProducesResponseType(typeof(BaseResponse<CalendarFeedDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> AddFeed([FromBody] AddCalendarFeedRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new AddCalendarFeedCommand(userId, request.Name, request.Url));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CalendarFeedDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<CalendarFeedDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Disconnect an external calendar
    /// </summary>
    [HttpDelete("feeds/{feedId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> RemoveFeed(Guid feedId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RemoveCalendarFeedCommand(userId, feedId));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Busy times imported from connected calendars, grouped per day — used by the planner
    /// </summary>
    [HttpGet("busy")]
    [ProducesResponseType(typeof(BaseResponse<BusyTimesDto>), 200)]
    public async Task<IActionResult> GetBusyTimes([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var userId = User.GetUserId();
        var fromDate = from ?? DateTime.UtcNow.Date;
        var toDate = to ?? fromDate.AddDays(7);
        var result = await _mediator.Send(new GetBusyTimesQuery(userId, fromDate, toDate));
        return Ok(BaseResponse<BusyTimesDto>.Ok(result.Data!));
    }
}
