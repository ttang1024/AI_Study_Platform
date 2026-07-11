using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private const string RefreshTokenCookieName = "refresh_token";
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(7);

    private readonly IMediator _mediator;

    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Stores the refresh token in an HttpOnly cookie so it is never exposed to JavaScript.
    /// </summary>
    private void SetRefreshTokenCookie(string refreshToken)
    {
        Response.Cookies.Append(RefreshTokenCookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/api/auth",
            Expires = DateTimeOffset.UtcNow.Add(RefreshTokenLifetime)
        });
    }

    private void ClearRefreshTokenCookie()
    {
        Response.Cookies.Append(RefreshTokenCookieName, string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/api/auth",
            Expires = DateTimeOffset.UnixEpoch
        });
    }

    /// <summary>
    /// Native apps have no HttpOnly cookie jar, so they identify themselves with this header
    /// and receive the refresh token in the response body instead of a cookie.
    /// </summary>
    private bool IsMobileClient() => Request.Headers["X-Client-Type"] == "mobile";

    /// <summary>
    /// Moves the refresh token from the response body into an HttpOnly cookie for web clients.
    /// Mobile clients keep the refresh token in the body since they can't read HttpOnly cookies.
    /// </summary>
    private AuthResponse IssueRefreshTokenCookie(AuthResponse response)
    {
        if (IsMobileClient())
            return response;

        SetRefreshTokenCookie(response.RefreshToken);
        return response with { RefreshToken = string.Empty };
    }

    /// <summary>
    /// Send OTP code to email for registration or password reset
    /// </summary>
    [HttpPost("send-otp")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SendOtp([FromBody] SendEmailOtpRequest request)
    {
        var result = await _mediator.Send(new SendEmailOtpCommand(request.Email, request.Purpose));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse<object> { Success = false, Message = result.Message, ErrorCode = result.ErrorCode, Errors = result.Errors });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Register a new user with OTP verification
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _mediator.Send(new RegisterCommand(request.Email, request.Password, request.FullName, request.OtpCode));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));

        return CreatedAtAction(nameof(Register), BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 401)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _mediator.Send(new LoginCommand(request.Email, request.Password));
        if (!result.IsSuccess)
            return Unauthorized(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Refresh access token using the refresh token stored in the HttpOnly cookie
    /// </summary>
    [HttpPost("refresh-token")]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 401)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest? request)
    {
        var refreshToken = IsMobileClient() ? request?.RefreshToken : Request.Cookies[RefreshTokenCookieName];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(BaseResponse<AuthResponse>.Fail("Refresh token is missing.", "INVALID_REFRESH_TOKEN"));

        var result = await _mediator.Send(new RefreshTokenCommand(refreshToken));
        if (!result.IsSuccess)
        {
            ClearRefreshTokenCookie();
            return Unauthorized(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));
        }

        return Ok(BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Reset password using OTP
    /// </summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await _mediator.Send(new ResetPasswordCommand(request.Email, request.OtpCode, request.NewPassword));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode, Errors = result.Errors });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Change password for authenticated user
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ChangePasswordCommand(userId, request.CurrentPassword, request.NewPassword));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode, Errors = result.Errors });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Update profile (display name) for authenticated user
    /// </summary>
    [HttpPut("update-profile")]
    [Authorize]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateProfileCommand(userId, request.FullName));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode, Errors = result.Errors });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Login or register using Google or GitHub OAuth
    /// </summary>
    [HttpPost("oauth")]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> OAuthLogin([FromBody] OAuthLoginRequest request)
    {
        var result = await _mediator.Send(new OAuthLoginCommand(request.Provider, request.Code, request.RedirectUri));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Login or register using a Google Identity Services credential token
    /// </summary>
    [HttpPost("google-credential")]
    [ProducesResponseType(typeof(BaseResponse<AuthResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GoogleCredentialLogin([FromBody] GoogleCredentialLoginRequest request)
    {
        var result = await _mediator.Send(new GoogleCredentialLoginCommand(request.Credential));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<AuthResponse>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<AuthResponse>.Ok(IssueRefreshTokenCookie(result.Data!), result.Message));
    }

    /// <summary>
    /// Logout and revoke the refresh token stored in the HttpOnly cookie
    /// </summary>
    [HttpPost("logout")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? request)
    {
        var refreshToken = IsMobileClient() ? request?.RefreshToken : Request.Cookies[RefreshTokenCookieName];
        var result = await _mediator.Send(new LogoutCommand(refreshToken ?? string.Empty));
        ClearRefreshTokenCookie();
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
