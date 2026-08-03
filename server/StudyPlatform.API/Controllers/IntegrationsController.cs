using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Auth;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Integrations;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Programmatic access: API keys, outbound webhooks, and Markdown export.
/// </summary>
[ApiController]
[Route("api/integrations")]
[Authorize]
[Produces("application/json")]
public class IntegrationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public IntegrationsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // ── API keys ────────────────────────────────────────────────────────────

    /// <summary>Your API keys. Never includes the keys themselves — only a prefix to identify them.</summary>
    [HttpGet("api-keys")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<ApiKeyDto>>), 200)]
    public async Task<IActionResult> GetApiKeys()
    {
        var result = await _mediator.Send(new GetApiKeysQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<ApiKeyDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>The scopes a key can be granted.</summary>
    [HttpGet("api-keys/scopes")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<string>>), 200)]
    public IActionResult GetScopes()
        => Ok(BaseResponse<IReadOnlyList<string>>.Ok(ApiKeyScopes.All));

    /// <summary>
    /// Creates a key. The plaintext is in this response and nowhere else — only a hash is stored.
    /// </summary>
    [HttpPost("api-keys")]
    [ProducesResponseType(typeof(BaseResponse<CreatedApiKeyDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateApiKey([FromBody] CreateApiKeyRequest request)
    {
        var result = await _mediator.Send(new CreateApiKeyCommand(
            User.GetUserId(), request.Name, request.Scopes, request.ExpiresInDays));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CreatedApiKeyDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return CreatedAtAction(nameof(GetApiKeys), BaseResponse<CreatedApiKeyDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("api-keys/{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RevokeApiKey(Guid id)
    {
        var result = await _mediator.Send(new RevokeApiKeyCommand(User.GetUserId(), id));
        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    // ── Webhooks ────────────────────────────────────────────────────────────

    [HttpGet("webhooks")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<WebhookDto>>), 200)]
    public async Task<IActionResult> GetWebhooks()
    {
        var result = await _mediator.Send(new GetWebhooksQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<WebhookDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>The events an endpoint can subscribe to.</summary>
    [HttpGet("webhooks/events")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<string>>), 200)]
    public IActionResult GetWebhookEvents()
        => Ok(BaseResponse<IReadOnlyList<string>>.Ok(WebhookEvents.All));

    /// <summary>Registers an endpoint. The signing secret is returned once.</summary>
    [HttpPost("webhooks")]
    [ProducesResponseType(typeof(BaseResponse<CreatedWebhookDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateWebhook([FromBody] CreateWebhookRequest request)
    {
        var result = await _mediator.Send(new CreateWebhookCommand(
            User.GetUserId(), request.Url, request.Events));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CreatedWebhookDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return CreatedAtAction(nameof(GetWebhooks), BaseResponse<CreatedWebhookDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("webhooks/{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteWebhook(Guid id)
    {
        var result = await _mediator.Send(new DeleteWebhookCommand(User.GetUserId(), id));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    // ── Markdown export ─────────────────────────────────────────────────────

    /// <summary>
    /// Downloads a course as a Markdown vault, ready to open in Obsidian.
    ///
    /// <para>Streamed directly rather than queued like the data export: one course of notes is small
    /// and builds in well under a request timeout, so making the user wait for a worker and come
    /// back for a link would be worse, not safer.</para>
    /// </summary>
    [HttpGet("export/markdown/{courseId:guid}")]
    [RequireApiScope(ApiKeyScopes.ReadLibrary)]
    [ProducesResponseType(typeof(FileResult), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> ExportMarkdown(
        Guid courseId,
        [FromServices] IMarkdownExportBuilder builder,
        CancellationToken cancellationToken)
    {
        var export = await builder.BuildAsync(User.GetUserId(), courseId, cancellationToken);
        if (export == null)
            return NotFound(new BaseResponse
            {
                Success = false,
                Message = "Course not found.",
                ErrorCode = "COURSE_NOT_FOUND",
            });

        return File(export.Value.Content, "application/zip", export.Value.FileName);
    }
}
