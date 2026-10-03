using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Server-sent streaming endpoints (summary, mindmap, chat).
public partial class VideoController
{
    // ── Streaming endpoints ───────────────────────────────────────────────

    [HttpPost("summary/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamSummary([FromBody] VideoUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null)
            return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = SummaryCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return await this.WriteSseCachedAsync(cached, cancellationToken);

        var transcript = await GetTranscriptTimelineTextAsync(videoId, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamTimelineSummaryAsync(transcript, cancellationToken);
        return await this.StreamAiToSseAsync(stream, cancellationToken,
            onCompleted: (text, ct) => _cache.SetAsync(cacheKey, text, ttl, ct));
    }

    [HttpPost("{id:guid}/summary/stream")]
    public async Task<IActionResult> StreamVideoSummary(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcript = await GetOrFetchTimelineTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamTimelineSummaryAsync(transcript, cancellationToken);
        return await this.StreamAiToSseAsync(stream, cancellationToken, onCompleted: async (text, ct) =>
        {
            video.Summary = text;
            video.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Videos.Update(video);
            await _unitOfWork.SaveChangesAsync(ct);
        });
    }

    [HttpPost("{id:guid}/chat/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamVideoChat(Guid id, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        if (ChatAttachments.TryDecodeTurn(request.Attachments, request.Message, out _, out var attachments) is { } invalid)
            return invalid;

        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        // Resolve the thread this turn belongs to. Old clients send no
        // conversation id — continue the latest thread (creating one if none).
        ChatConversation? conversation;
        if (request.ConversationId is { } conversationId)
        {
            conversation = await _unitOfWork.ChatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
            if (conversation is null || conversation.VideoId != id)
                return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));
        }
        else
        {
            await ChatThreads.AdoptLegacyVideoChatAsync(_unitOfWork, id, userId, cancellationToken);
            var existing = await _unitOfWork.ChatMessages.GetConversationsByVideoIdAsync(id, userId, cancellationToken);
            conversation = existing.FirstOrDefault()
                ?? await _unitOfWork.ChatMessages.CreateVideoConversationAsync(userId, id, ChatThreads.DefaultTitle, cancellationToken);
        }

        var promptMessage = ChatAttachments.PromptOrDefault(request.Message);
        var attachmentsJson = await ChatAttachmentStore.SaveAsync(_blobStorageService, attachments, userId, cancellationToken);
        var savedMessage = request.Message ?? string.Empty;

        var history = await _unitOfWork.ChatMessages.GetByConversationIdAsync(conversation.ConversationId, userId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();
        var videoTranscript = await GetOrFetchTranscriptAsync(video, cancellationToken) ?? string.Empty;

        var stream = _aiService.StreamChatWithYouTubeAsync(videoTranscript, historyTuples, promptMessage, ChatAttachments.ToModelInputs(attachments), cancellationToken);
        var thread = new ChatThread(userId, conversation, "video", VideoId: id);
        return await this.StreamAiToSseAsync(stream, cancellationToken,
            beforeStream: ct => _chatTurns.RecordUserAsync(
                thread,
                savedMessage,
                attachmentsJson,
                historyTuples.Count == 0 && conversation.Title == ChatThreads.DefaultTitle
                    ? ChatThreads.TitleFrom(promptMessage)
                    : null,
                ct),
            onCompleted: (text, ct) => _chatTurns.RecordAssistantAsync(thread, text, ct));
    }
}
