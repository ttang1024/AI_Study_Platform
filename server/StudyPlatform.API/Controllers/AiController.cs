using System.Text.Json;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

public record GeneralChatRequest(
    string Message,
    IEnumerable<ChatHistoryEntry> History);

public record CreateGeneralChatConversationRequest(string? Title);

public record GeneralChatConversationDto(
    Guid ConversationId,
    string Title,
    DateTime CreatedAt,
    DateTime UpdatedAt);

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

    /// <summary>Create a standalone AI chat conversation.</summary>
    [HttpPost("chat/conversations")]
    [ProducesResponseType(typeof(BaseResponse<GeneralChatConversationDto>), 200)]
    public async Task<IActionResult> CreateChatConversation([FromBody] CreateGeneralChatConversationRequest? request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var conversation = await _unitOfWork.ChatMessages.CreateConversationAsync(
            userId,
            request?.Title ?? "New conversation",
            cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(BaseResponse<GeneralChatConversationDto>.Ok(ToConversationDto(conversation)));
    }

    /// <summary>Get standalone AI chat messages for a conversation.</summary>
    [HttpGet("chat/conversations/{conversationId:guid}/messages")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse<string>), 404)]
    public async Task<IActionResult> GetChatConversationMessages(Guid conversationId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var conversation = await _unitOfWork.ChatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is null)
            return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));

        var messages = await _unitOfWork.ChatMessages.GetByConversationIdAsync(conversationId, userId, cancellationToken);
        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(messages.Select(ToChatMessageDto)));
    }

    /// <summary>Delete a standalone AI chat conversation.</summary>
    [HttpDelete("chat/conversations/{conversationId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse<string>), 404)]
    public async Task<IActionResult> DeleteChatConversation(Guid conversationId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var conversation = await _unitOfWork.ChatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is null)
            return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));

        await _unitOfWork.ChatMessages.DeleteConversationAsync(conversationId, userId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(BaseResponse<string>.Ok("Conversation deleted."));
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

    /// <summary>Streaming standalone AI chat, saving messages to DB on completion.</summary>
    [HttpPost("chat/conversations/{conversationId:guid}/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamChatConversation(Guid conversationId, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var userId = User.GetUserId();
        var conversation = await _unitOfWork.ChatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is null)
            return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));

        var history = await _unitOfWork.ChatMessages.GetByConversationIdAsync(conversationId, userId, cancellationToken);
        var stream = _aiService.StreamGeneralChatAsync(history.Select(m => (m.Role, m.Content)), request.Message, cancellationToken);
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

        var now = DateTime.UtcNow;
        await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            ChatConversationId = conversationId,
            SourceType = "general",
            UserId = userId,
            Role = "user",
            Content = request.Message,
            CreatedAt = now
        }, cancellationToken);

        if (!history.Any())
            conversation.Title = CreateTitle(request.Message);
        conversation.UpdatedAt = now;
        _unitOfWork.ChatMessages.UpdateConversation(conversation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var fullResponse = new StringBuilder();
        try
        {
            fullResponse.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullResponse.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullResponse.Length > 0)
            {
                var completedAt = DateTime.UtcNow;
                await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    ChatConversationId = conversationId,
                    SourceType = "general",
                    UserId = userId,
                    Role = "assistant",
                    Content = fullResponse.ToString(),
                    CreatedAt = completedAt
                }, cancellationToken);

                conversation.UpdatedAt = completedAt;
                _unitOfWork.ChatMessages.UpdateConversation(conversation);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
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

    private static GeneralChatConversationDto ToConversationDto(ChatConversation conversation)
        => new(conversation.ConversationId, conversation.Title, conversation.CreatedAt, conversation.UpdatedAt);

    private static ChatMessageDto ToChatMessageDto(ChatMessage message)
        => new(
            message.MessageId,
            message.DocumentId,
            message.YouTubeVideoId,
            message.SourceType,
            message.Role,
            message.Content,
            message.CreatedAt);

    private static string CreateTitle(string message)
    {
        var compact = string.Join(' ', message.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return compact.Length > 42 ? compact[..39] + "..." : compact;
    }
}
