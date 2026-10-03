using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Feedback.Commands;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/feedback")]
[Authorize]
[Produces("application/json")]
public class FeedbackController : ControllerBase
{
    private readonly IMediator _mediator;

    public FeedbackController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SubmitFeedbackRequest request)
    {
        var userId = User.GetUserId();
        var userEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;

        var result = await _mediator.Send(new SubmitFeedbackCommand(
            request.Type, request.Subject, request.Message, request.Rating, userId, userEmail));

        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record SubmitFeedbackRequest(string Type, string Subject, string Message, int? Rating);
