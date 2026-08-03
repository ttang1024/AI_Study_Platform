using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Security.Queries;

namespace StudyPlatform.API.Controllers;

public partial class SecurityController
{
    /// <summary>Queues a full export of everything the platform holds on you.</summary>
    [HttpPost("exports")]
    [ProducesResponseType(typeof(BaseResponse<DataExportDto>), 202)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RequestExport()
    {
        var result = await _mediator.Send(new RequestDataExportCommand(User.GetUserId()));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DataExportDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Accepted(BaseResponse<DataExportDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Your export requests, newest first, with their status.</summary>
    [HttpGet("exports")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<DataExportDto>>), 200)]
    public async Task<IActionResult> GetExports()
    {
        var result = await _mediator.Send(new GetDataExportsQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<DataExportDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Returns a short-lived signed URL for a finished export.</summary>
    [HttpGet("exports/{id:guid}/download")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DownloadExport(Guid id)
    {
        var result = await _mediator.Send(new GetDataExportDownloadQuery(User.GetUserId(), id));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<string>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Schedules account deletion. Takes effect immediately for access; the data is erased after a
    /// grace period during which <see cref="CancelAccountDeletion"/> can call it off.
    /// </summary>
    [HttpPost("account/delete")]
    [ProducesResponseType(typeof(BaseResponse<DateTime>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RequestAccountDeletion([FromBody] DeleteAccountRequest request)
    {
        var result = await _mediator.Send(
            new RequestAccountDeletionCommand(User.GetUserId(), request.Password, request.Confirmation));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DateTime>.Fail(result.Message, result.ErrorCode, result.Errors));

        // Requesting deletion revoked every session, including this one, so the cookie has to go too
        // or the browser keeps presenting a token that no longer resolves.
        Response.Cookies.Append(RefreshTokenCookieName, string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/api/auth",
            Expires = DateTimeOffset.UnixEpoch,
        });

        return Ok(BaseResponse<DateTime>.Ok(result.Data, result.Message));
    }

    /// <summary>
    /// Calls off a scheduled deletion. Anonymous because requesting deletion signs the user out
    /// everywhere — there is no session left to authorize with, so the password stands in.
    /// </summary>
    [HttpPost("/api/auth/cancel-deletion")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CancelAccountDeletion([FromBody] CancelAccountDeletionRequest request)
    {
        var result = await _mediator.Send(new CancelAccountDeletionCommand(request.Email, request.Password));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record CancelAccountDeletionRequest(string Email, string Password);
