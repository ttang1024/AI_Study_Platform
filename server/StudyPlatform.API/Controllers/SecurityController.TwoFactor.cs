using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Security.Queries;

namespace StudyPlatform.API.Controllers;

public partial class SecurityController
{
    /// <summary>Whether two-factor authentication is on, and how many recovery codes are left.</summary>
    [HttpGet("2fa")]
    [ProducesResponseType(typeof(BaseResponse<TwoFactorStatusDto>), 200)]
    public async Task<IActionResult> GetTwoFactorStatus()
    {
        var result = await _mediator.Send(new GetTwoFactorStatusQuery(User.GetUserId()));
        return Ok(BaseResponse<TwoFactorStatusDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Begins enrolment and returns the secret plus the otpauth URI to render as a QR code.
    /// Nothing is enforced until <see cref="ConfirmTwoFactor"/> succeeds.
    /// </summary>
    [HttpPost("2fa/setup")]
    [ProducesResponseType(typeof(BaseResponse<TwoFactorSetupDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> StartTwoFactorSetup()
    {
        var result = await _mediator.Send(new StartTwoFactorSetupCommand(User.GetUserId()));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<TwoFactorSetupDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<TwoFactorSetupDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Confirms enrolment with a code from the authenticator, and returns recovery codes once.</summary>
    [HttpPost("2fa/confirm")]
    [ProducesResponseType(typeof(BaseResponse<TwoFactorEnabledDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ConfirmTwoFactor([FromBody] EnableTwoFactorRequest request)
    {
        var result = await _mediator.Send(new ConfirmTwoFactorSetupCommand(User.GetUserId(), request.Code));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<TwoFactorEnabledDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<TwoFactorEnabledDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Turns the second factor off. Requires the account password.</summary>
    [HttpPost("2fa/disable")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> DisableTwoFactor([FromBody] DisableTwoFactorRequest request)
    {
        var result = await _mediator.Send(new DisableTwoFactorCommand(User.GetUserId(), request.Password));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode, Errors = result.Errors });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>Issues a new set of recovery codes and invalidates the old ones.</summary>
    [HttpPost("2fa/recovery-codes")]
    [ProducesResponseType(typeof(BaseResponse<TwoFactorEnabledDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RegenerateRecoveryCodes([FromBody] RegenerateRecoveryCodesRequest request)
    {
        var result = await _mediator.Send(new RegenerateRecoveryCodesCommand(User.GetUserId(), request.Password));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<TwoFactorEnabledDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<TwoFactorEnabledDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Second leg of a 2FA login. Anonymous by necessity: the caller has no token yet — that is the
    /// entire point of this call — and the challenge handle is what stands in for one.
    /// </summary>
    [HttpPost("/api/auth/2fa/verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 401)]
    public async Task<IActionResult> VerifyTwoFactorLogin([FromBody] VerifyTwoFactorRequest request)
    {
        var result = await _mediator.Send(new VerifyTwoFactorLoginCommand(request.ChallengeToken, request.Code));
        if (!result.IsSuccess)
            return Unauthorized(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Mirrors AuthController's cookie handling so the token issued by the second leg is stored the
    /// same way as one from a single-leg login — web gets an HttpOnly cookie, native gets the body.
    /// </summary>
    private AuthResponse IssueRefreshTokenCookie(AuthResponse response)
    {
        if (Request.Headers["X-Client-Type"] == "mobile")
            return response;

        Response.Cookies.Append(RefreshTokenCookieName, response.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/api/auth",
            Expires = DateTimeOffset.UtcNow.Add(TimeSpan.FromDays(7)),
        });

        return response with { RefreshToken = string.Empty };
    }
}
