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
            if (AiErrorMapper.TryGetAiError(ex.Message, out var statusCode, out var errorCode))
                return StatusCode(statusCode, BaseResponse<string>.Fail(ex.Message, errorCode));

            return BadRequest(BaseResponse<string>.Fail(ex.Message));
        }
    }

    /// <summary>Streaming general AI study tutor chat (SSE).</summary>
    [HttpPost("chat/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamChat([FromBody] GeneralChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var history = (request.History ?? []).Select(h => (h.Role, h.Content));
        var stream = _aiService.StreamGeneralChatAsync(history, request.Message, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiErrorMapper.ToObjectResult(this, ex.Message);
        }

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        try
        {
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                await WriteSseDataAsync(enumerator.Current, cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    private async Task WriteSseDataAsync(string data, CancellationToken cancellationToken)
    {
        await Response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
