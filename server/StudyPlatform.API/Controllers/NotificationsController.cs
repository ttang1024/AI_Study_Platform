using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Application.Notifications;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Controllers;

public record PushSubscribeRequest(string Endpoint, string P256dh, string Auth);
public record PushUnsubscribeRequest(string Endpoint);

[ApiController]
[Route("api/notifications")]
[Authorize]
[Produces("application/json")]
public class NotificationsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IPushNotificationService _push;

    public NotificationsController(IMediator mediator, IPushNotificationService push)
    {
        _mediator = mediator;
        _push = push;
    }

    /// <summary>
    /// VAPID public key used by the browser to create a push subscription.
    /// Empty string means push is not configured on this deployment.
    /// </summary>
    [HttpGet("push/public-key")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    public IActionResult GetPushPublicKey()
        => Ok(BaseResponse<string>.Ok(_push.PublicKey));

    /// <summary>Register this browser for due-review push reminders.</summary>
    [HttpPost("push/subscribe")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    public async Task<IActionResult> PushSubscribe([FromBody] PushSubscribeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint) || string.IsNullOrWhiteSpace(request.P256dh) || string.IsNullOrWhiteSpace(request.Auth))
            return BadRequest(BaseResponse<bool>.Fail("Endpoint, p256dh and auth are required."));
        await _push.SubscribeAsync(User.GetUserId(), request.Endpoint, request.P256dh, request.Auth, ct);
        return Ok(BaseResponse<bool>.Ok(true));
    }

    /// <summary>Remove this browser's push subscription.</summary>
    [HttpPost("push/unsubscribe")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    public async Task<IActionResult> PushUnsubscribe([FromBody] PushUnsubscribeRequest request, CancellationToken ct)
    {
        await _push.UnsubscribeAsync(User.GetUserId(), request.Endpoint, ct);
        return Ok(BaseResponse<bool>.Ok(true));
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

    /// <summary>
    /// "Your week in review": study time, reviews, quiz accuracy, mistakes closed, streak, top gap.
    /// </summary>
    [HttpGet("weekly-digest")]
    [ProducesResponseType(typeof(BaseResponse<WeeklyDigestDto>), 200)]
    public async Task<IActionResult> GetWeeklyDigest()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetWeeklyDigestQuery(userId));
        return Ok(BaseResponse<WeeklyDigestDto>.Ok(result.Data!));
    }
}
