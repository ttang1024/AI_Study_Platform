using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyQueue;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/study-queue")]
[Authorize]
[Produces("application/json")]
public class StudyQueueController : ControllerBase
{
    private readonly IMediator _mediator;

    public StudyQueueController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get the adaptive daily study queue for the authenticated user.
    /// </summary>
    [HttpGet("daily")]
    [ProducesResponseType(typeof(BaseResponse<DailyStudyQueueDto>), 200)]
    public async Task<IActionResult> GetDailyQueue([FromQuery] int limit = 8)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDailyStudyQueueQuery(userId, limit));
        return Ok(BaseResponse<DailyStudyQueueDto>.Ok(result.Data!));
    }
}
