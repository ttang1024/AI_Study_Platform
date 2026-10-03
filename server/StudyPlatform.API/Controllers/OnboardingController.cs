using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Onboarding;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// The getting-started checklist, and the sample course that gives a new account something to look
/// at before they have configured an AI provider.
/// </summary>
[ApiController]
[Route("api/onboarding")]
[Authorize]
[Produces("application/json")]
public class OnboardingController : ControllerBase
{
    private readonly IMediator _mediator;

    public OnboardingController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Checklist state, derived from the user's library rather than stored.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<OnboardingStateDto>), 200)]
    public async Task<IActionResult> GetState(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetOnboardingStateQuery(User.GetUserId()), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<OnboardingStateDto>.Ok(result.Data!))
            : NotFound(BaseResponse<OnboardingStateDto>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>Hides the checklist for good.</summary>
    [HttpPost("dismiss")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    public async Task<IActionResult> Dismiss(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new DismissOnboardingCommand(User.GetUserId()), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<bool>.Ok(result.Data, result.Message))
            : NotFound(BaseResponse<bool>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>
    /// Adds a small worked example — course, document, summary, cards, quiz and glossary. Uses no
    /// AI, so it works before the user has a provider key and costs them nothing.
    /// </summary>
    [HttpPost("demo")]
    [ProducesResponseType(typeof(BaseResponse<Guid>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SeedDemo(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new SeedDemoContentCommand(User.GetUserId()), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<Guid>.Ok(result.Data, result.Message))
            : BadRequest(BaseResponse<Guid>.Fail(result.Message, result.ErrorCode));
    }
}
