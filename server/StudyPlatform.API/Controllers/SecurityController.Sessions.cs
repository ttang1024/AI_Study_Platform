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
    /// <summary>Every device currently signed in, with the caller's own flagged.</summary>
    [HttpGet("sessions")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<SessionDto>>), 200)]
    public async Task<IActionResult> GetSessions()
    {
        var result = await _mediator.Send(new GetSessionsQuery(User.GetUserId(), CurrentRefreshToken(null)));
        return Ok(BaseResponse<IReadOnlyList<SessionDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Signs one device out.</summary>
    [HttpDelete("sessions/{sessionId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RevokeSession(Guid sessionId)
    {
        var result = await _mediator.Send(new RevokeSessionCommand(User.GetUserId(), sessionId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>Signs out every device except this one.</summary>
    [HttpPost("sessions/revoke-others")]
    [ProducesResponseType(typeof(BaseResponse<int>), 200)]
    public async Task<IActionResult> RevokeOtherSessions([FromBody] RefreshTokenRequest? request)
    {
        var result = await _mediator.Send(
            new RevokeOtherSessionsCommand(User.GetUserId(), CurrentRefreshToken(request?.RefreshToken)));

        return Ok(BaseResponse<int>.Ok(result.Data, result.Message));
    }
}
