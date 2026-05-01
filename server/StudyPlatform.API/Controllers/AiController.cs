using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

public record GeneralChatRequest(
    string Message,
    IEnumerable<ChatHistoryEntry> History);

[ApiController]
[Route("api/ai")]
[Authorize]
[Produces("application/json")]
public class AiController : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly IUnitOfWork _unitOfWork;

    public AiController(IAiService aiService, IUnitOfWork unitOfWork)
    {
        _aiService = aiService;
        _unitOfWork = unitOfWork;
    }

    /// <summary>Get all chat conversation summaries (documents + videos) for the current user.</summary>
    [HttpGet("chat/sessions")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatConversationSummary>>), 200)]
    public async Task<IActionResult> GetChatSessions(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var summaries = await _unitOfWork.ChatMessages.GetConversationSummariesAsync(userId, cancellationToken);
        return Ok(BaseResponse<IEnumerable<ChatConversationSummary>>.Ok(summaries));
    }

    /// <summary>General AI study tutor chat.</summary>
    [HttpPost("chat")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    public async Task<IActionResult> Chat([FromBody] GeneralChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var history = (request.History ?? []).Select(h => (h.Role, h.Content));
        var reply = await _aiService.GeneralChatAsync(history, request.Message, cancellationToken);
        return Ok(BaseResponse<string>.Ok(reply));
    }

    /// <summary>Test connection to the configured AI provider.</summary>
    [HttpGet("test-provider")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    public async Task<IActionResult> TestProvider(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _aiService.TestConnectionAsync(cancellationToken);
            return Ok(BaseResponse<string>.Ok(result.Trim()));
        }
        catch (Exception ex)
        {
            return BadRequest(BaseResponse<string>.Fail(ex.Message));
        }
    }

    /// <summary>Streaming general AI study tutor chat (SSE).</summary>
    [HttpPost("chat/stream")]
    public async Task StreamChat([FromBody] GeneralChatRequest request, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            Response.StatusCode = 400;
            return;
        }

        var history = (request.History ?? []).Select(h => (h.Role, h.Content));
        try
        {
            await foreach (var chunk in _aiService.StreamGeneralChatAsync(history, request.Message, cancellationToken))
            {
                await Response.WriteAsync($"data: {JsonSerializer.Serialize(chunk)}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex)
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize("[ERROR] " + ex.Message)}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
