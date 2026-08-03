using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Certificates;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

/// <summary>Course-completion certificates and their public verification page.</summary>
[ApiController]
[Route("api/certificates")]
[Authorize]
[Produces("application/json")]
public class CertificatesController : ControllerBase
{
    private readonly IMediator _mediator;

    public CertificatesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Certificates you hold, newest first.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<CertificateDto>>), 200)]
    public async Task<IActionResult> GetMine()
    {
        var result = await _mediator.Send(new GetMyCertificatesQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<CertificateDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Where each course stands against the certificate threshold.</summary>
    [HttpGet("eligibility")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<CertificateEligibilityDto>>), 200)]
    public async Task<IActionResult> GetEligibility()
    {
        var result = await _mediator.Send(new GetCertificateEligibilityQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<CertificateEligibilityDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Issues a certificate for a course, if its mastery score qualifies.</summary>
    [HttpPost("courses/{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<CertificateDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Issue(Guid courseId)
    {
        var result = await _mediator.Send(new IssueCertificateCommand(User.GetUserId(), courseId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CertificateDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<CertificateDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Withdraws a certificate. Its share link starts reporting it as revoked.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Revoke(Guid id)
    {
        var result = await _mediator.Send(new RevokeCertificateCommand(User.GetUserId(), id));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Public verification. Anonymous by design — the whole point is that someone who was sent the
    /// link can check it without an account. Returns only what a certificate displays.
    /// </summary>
    [HttpGet("/api/verify/{token}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BaseResponse<PublicCertificateDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> Verify(string token)
    {
        var result = await _mediator.Send(new VerifyCertificateQuery(token));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<PublicCertificateDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<PublicCertificateDto>.Ok(result.Data!, result.Message));
    }
}
