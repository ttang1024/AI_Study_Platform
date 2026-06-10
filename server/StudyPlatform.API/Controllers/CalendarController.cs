using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Calendar;

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
}
