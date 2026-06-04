using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Notifications;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
[Produces("application/json")]
public class NotificationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public NotificationsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get the review-reminder digest: due cards, streak at risk, today's goal gap,
    /// top knowledge gap, and review suggestions.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<NotificationsDto>), 200)]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetNotificationsQuery(userId));
        return Ok(BaseResponse<NotificationsDto>.Ok(result.Data!));
    }
}
