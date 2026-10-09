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
    /// grace period during which signing in again calls it off (see <c>PendingDeletion</c>).
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
}
