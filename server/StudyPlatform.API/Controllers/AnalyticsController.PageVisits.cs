using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Analytics.Commands;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Page-view ingest. The only write endpoint in the app that anonymous callers may reach, because
/// half the traffic worth measuring — the landing page, login, a shared link — happens before
/// anyone signs in.
/// </summary>
public partial class AnalyticsController
{
    /// <summary>
    /// Record a page view (called by the web app on every route change)
    /// </summary>
    [HttpPost("page-visits")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> RecordPageVisit([FromBody] RecordPageVisitRequest request)
    {
        // A valid token still populates the principal on an [AllowAnonymous] route, so signed-in
        // visits get attributed without the client having to say who it is.
        var result = await _mediator.Send(new RecordPageVisitCommand(
            UserId: User.GetUserIdOrNull(),
            Path: request.Path,
            Referrer: request.Referrer,
            VisitorId: request.VisitorId,
            SessionId: request.SessionId,
            UserAgent: Request.Headers[HeaderNames.UserAgent].ToString(),
            SelfHost: Request.Host.Host));

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

/// <param name="Path">Site-relative path; the server collapses it to a route pattern.</param>
/// <param name="Referrer">document.referrer, or null. Reduced to its host before it is stored.</param>
/// <param name="VisitorId">Random browser-scoped id minted by the client.</param>
/// <param name="SessionId">Random tab-scoped id minted by the client.</param>
public record RecordPageVisitRequest(string Path, string? Referrer, string VisitorId, string SessionId);
