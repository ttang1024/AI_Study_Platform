using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Security.Queries;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Account security: second factor, sessions, and the security log.
///
/// <para>Split into partial files by concern the way the other large controllers are —
/// <c>.TwoFactor</c>, <c>.Sessions</c>, <c>.Data</c> — with the shared plumbing here.</para>
/// </summary>
[ApiController]
[Route("api/security")]
[Authorize]
[Produces("application/json")]
public partial class SecurityController : ControllerBase
{
    private const string RefreshTokenCookieName = "refresh_token";

    private readonly IMediator _mediator;

    public SecurityController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Header native clients use to present their refresh token on requests with no body.
    ///
    /// <para>A header rather than a query parameter: query strings are written to access logs and
    /// proxy logs by default, and a refresh token is a credential.</para>
    /// </summary>
    private const string RefreshTokenHeaderName = "X-Refresh-Token";

    /// <summary>
    /// The caller's own refresh token, so session endpoints can tell "this device" from the rest.
    /// Web clients keep it in an HttpOnly cookie; native clients send it in the body where there is
    /// one, and in <see cref="RefreshTokenHeaderName"/> on GETs where there is not.
    /// </summary>
    private string? CurrentRefreshToken(string? fromBody)
    {
        if (Request.Headers["X-Client-Type"] != "mobile")
            return Request.Cookies[RefreshTokenCookieName];

        if (!string.IsNullOrEmpty(fromBody))
            return fromBody;

        var header = Request.Headers[RefreshTokenHeaderName].ToString();
        return string.IsNullOrWhiteSpace(header) ? null : header;
    }

    /// <summary>Your own security history: sign-ins, factor changes, session revocations.</summary>
    [HttpGet("audit-log")]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<AuditEntryDto>>), 200)]
    public async Task<IActionResult> GetAuditLog([FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        var result = await _mediator.Send(new GetAuditLogQuery(User.GetUserId(), page, pageSize));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<PaginatedList<AuditEntryDto>>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<PaginatedList<AuditEntryDto>>.Ok(result.Data!, result.Message));
    }
}
