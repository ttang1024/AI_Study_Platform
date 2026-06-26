using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Admin.Commands;
using StudyPlatform.Application.Admin.Queries;
using StudyPlatform.Application.Common;
using System.Security.Claims;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/admin")]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private readonly IMediator _mediator;

    public AdminController(IMediator mediator) => _mediator = mediator;

    [HttpPost("auth/login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest request)
    {
        var result = await _mediator.Send(new AdminLoginCommand(request.Email, request.Password));
        if (!result.IsSuccess)
            return Unauthorized(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(new { token = result.Data!.Token });
    }

    [HttpGet("feedback/stats")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStats()
    {
        var result = await _mediator.Send(new GetFeedbackStatsQuery());
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<object>.Fail(result.Message));

        var d = result.Data!;
        return Ok(new
        {
            total = d.Total,
            byType = d.ByType,
            byStatus = d.ByStatus,
            averageRating = d.AverageRating,
            recentCount = d.RecentCount,
        });
    }

    [HttpGet("feedback")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ListFeedback(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] string? search = null,
        [FromQuery] string? sort = null)
    {
        var result = await _mediator.Send(new ListFeedbackQuery(page, pageSize, status, type, search, sort));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<object>.Fail(result.Message));

        var p = result.Data!;
        return Ok(new
        {
            items = p.Items,
            total = p.TotalCount,
            page = p.Page,
            pageSize = p.PageSize,
        });
    }

    [HttpGet("feedback/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetFeedback(Guid id)
    {
        var result = await _mediator.Send(new GetFeedbackByIdQuery(id));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(result.Data);
    }

    [HttpPatch("feedback/{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var result = await _mediator.Send(new UpdateFeedbackStatusCommand(id, request.Status));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(result.Data);
    }

    [HttpPatch("feedback/{id:guid}/note")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SaveNote(Guid id, [FromBody] SaveNoteRequest request)
    {
        var result = await _mediator.Send(new SaveAdminNoteCommand(id, request.AdminNote));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(result.Data);
    }

    [HttpDelete("feedback/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteFeedback(Guid id)
    {
        var result = await _mediator.Send(new DeleteFeedbackCommand(id));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return NoContent();
    }

    // ── Platform Analytics ───────────────────────────────────────────────────

    [HttpGet("analytics")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPlatformAnalytics()
    {
        var result = await _mediator.Send(new GetPlatformAnalyticsQuery());
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<object>.Fail(result.Message));

        return Ok(result.Data);
    }

    // ── User Management ──────────────────────────────────────────────────────

    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ListUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sort = null)
    {
        var result = await _mediator.Send(new ListUsersQuery(page, pageSize, search, status, sort));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<object>.Fail(result.Message));

        var p = result.Data!;
        return Ok(new { items = p.Items, total = p.TotalCount, page = p.Page, pageSize = p.PageSize });
    }

    [HttpGet("users/{id:guid}/detail")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUserDetail(Guid id)
    {
        var result = await _mediator.Send(new GetUserDetailQuery(id));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(result.Data);
    }

    [HttpPatch("users/{id:guid}/active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetUserActive(Guid id, [FromBody] SetUserActiveRequest request)
    {
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(adminId, out var adminGuid) && adminGuid == id)
            return BadRequest(BaseResponse<object>.Fail("Cannot change your own account status."));

        var result = await _mediator.Send(new SetUserActiveStatusCommand(id, request.IsActive));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(BaseResponse<object>.Fail(result.Message, result.ErrorCode))
                : BadRequest(BaseResponse<object>.Fail(result.Message, result.ErrorCode));

        return Ok(result.Data);
    }
}

public record AdminLoginRequest(string Email, string Password);
public record UpdateStatusRequest(string Status);
public record SaveNoteRequest(string AdminNote);
public record SetUserActiveRequest(bool IsActive);
