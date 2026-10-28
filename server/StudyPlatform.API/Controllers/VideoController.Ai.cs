using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Videos.Generation;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

// AI generation (mindmap, quiz, flashcards) & saved-video chat endpoints.
public partial class VideoController
{
    // ── AI generation ─────────────────────────────────────────────────────
    // Validation, caching, transcript lookup and generation all live in IVideoAiGenerator; these actions
    // only pick the artifact and the response shape.

    [HttpPost("mindmap")]
    public Task<IActionResult> GenerateMindMap([FromBody] VideoUrlRequest request, CancellationToken cancellationToken)
        => GenerateForUrl(request, VideoAiArtifact.MindMap, cancellationToken);

    [HttpPost("mindmap/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public Task<IActionResult> StreamMindMap([FromBody] VideoUrlRequest request, CancellationToken cancellationToken)
        => StreamForUrl(request, VideoAiArtifact.MindMap, cancellationToken);

    [HttpPost("{id:guid}/mindmap/stream")]
    public Task<IActionResult> StreamVideoMindMap(Guid id, CancellationToken cancellationToken)
        => StreamForSavedVideo(id, VideoAiArtifact.MindMap, cancellationToken);

    [HttpPost("quiz")]
    public Task<IActionResult> GenerateQuiz([FromBody] VideoUrlRequest request, CancellationToken cancellationToken)
        => GenerateForUrl(request, VideoAiArtifact.Quiz, cancellationToken);

    [HttpPost("flashcards")]
    public Task<IActionResult> GenerateFlashcards([FromBody] VideoUrlRequest request, CancellationToken cancellationToken)
        => GenerateForUrl(request, VideoAiArtifact.Flashcards, cancellationToken);

    private async Task<IActionResult> GenerateForUrl(VideoUrlRequest request, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        var result = await _videoAi.GenerateForUrlAsync(request.VideoUrl, artifact, cancellationToken);
        return result.IsSuccess
            ? Ok(BaseResponse<string>.Ok(result.Data!))
            : BadRequest(BaseResponse<string>.Fail(result.Message, result.ErrorCode));
    }

    private async Task<IActionResult> StreamForUrl(VideoUrlRequest request, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        var result = await _videoAi.StreamForUrlAsync(request.VideoUrl, artifact, cancellationToken);
        return result.IsSuccess
            ? await this.WriteAiTextStreamAsync(result.Data!, cancellationToken)
            : BadRequest(BaseResponse<string>.Fail(result.Message, result.ErrorCode));
    }

    private async Task<IActionResult> StreamForSavedVideo(Guid id, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        var result = await _videoAi.StreamForSavedVideoAsync(id, User.GetUserId(), artifact, cancellationToken);
        if (result.IsSuccess)
            return await this.WriteAiTextStreamAsync(result.Data!, cancellationToken);
        return result.ErrorCode == "VIDEO_NOT_FOUND"
            ? NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode))
            : BadRequest(BaseResponse<string>.Fail(result.Message, result.ErrorCode));
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] VideoChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        List<(byte[] data, string mimeType, string? fileName)> attachments;
        try { attachments = ChatAttachments.Decode(request.Attachments); }
        catch (ArgumentException ex) { return BadRequest(BaseResponse<string>.Fail(ex.Message, "INVALID_ATTACHMENT")); }

        if (string.IsNullOrWhiteSpace(request.Message) && attachments.Count == 0)
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null) return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));
        var transcript = await _transcripts.GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null) return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var history = (request.History ?? []).Select(h => (h.Role, h.Content));
        var message = ChatAttachments.PromptOrDefault(request.Message);

        string reply;
        if (attachments.Count > 0)
        {
            var sb = new System.Text.StringBuilder();
            await foreach (var chunk in _aiService.StreamChatWithYouTubeAsync(transcript, history, message, ChatAttachments.ToModelInputs(attachments), cancellationToken))
                sb.Append(chunk);
            reply = sb.ToString();
        }
        else
        {
            reply = await _aiService.ChatWithYouTubeAsync(transcript, history, message, cancellationToken);
        }
        return Ok(BaseResponse<string>.Ok(reply));
    }

    // ── Saved video chat (persisted) ─────────────────────────────────────

    [HttpGet("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    public async Task<IActionResult> GetVideoChatHistory(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<ChatMessageDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var messages = await _chatMessages.GetByVideoIdAsync(id, video.UserId, cancellationToken);
        var dtos = new List<ChatMessageDto>();
        foreach (var m in messages)
            dtos.Add(await m.ToDtoAsync(_blobStorageService, cancellationToken));
        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(dtos));
    }

    // ── Video chat conversations (multiple threads per video) ────────────

    /// <summary>List this video's chat threads, newest first.</summary>
    [HttpGet("{id:guid}/chat/conversations")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatThreadSummary>>), 200)]
    public async Task<IActionResult> GetVideoChatConversations(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        await ChatThreads.AdoptLegacyVideoChatAsync(_chatMessages, _unitOfWork, id, userId, cancellationToken);

        var conversations = await _chatMessages.GetVideoThreadSummariesAsync(id, userId, cancellationToken);
        return Ok(BaseResponse<IEnumerable<ChatThreadSummary>>.Ok(conversations));
    }

    /// <summary>Start a new chat thread for this video.</summary>
    [HttpPost("{id:guid}/chat/conversations")]
    [ProducesResponseType(typeof(BaseResponse<ChatThreadSummary>), 200)]
    public async Task<IActionResult> CreateVideoChatConversation(Guid id, [FromBody] CreateChatThreadRequest? request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var conversation = await _chatMessages.CreateVideoConversationAsync(
            userId, id, request?.Title ?? ChatThreads.DefaultTitle, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Ok(BaseResponse<ChatThreadSummary>.Ok(new ChatThreadSummary(
            conversation.ConversationId, conversation.Title, conversation.CreatedAt, conversation.UpdatedAt, 0, null)));
    }

    /// <summary>Messages of one chat thread (attachments as presigned URLs).</summary>
    [HttpGet("{id:guid}/chat/conversations/{conversationId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    public async Task<IActionResult> GetVideoChatConversationMessages(Guid id, Guid conversationId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var conversation = await _chatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is null || conversation.VideoId != id)
            return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));

        var messages = await _chatMessages.GetByConversationIdAsync(conversationId, userId, cancellationToken);
        var dtos = new List<ChatMessageDto>();
        foreach (var m in messages)
            dtos.Add(await m.ToDtoAsync(_blobStorageService, cancellationToken));
        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(dtos));
    }

    /// <summary>Delete one chat thread (its messages cascade).</summary>
    [HttpDelete("{id:guid}/chat/conversations/{conversationId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    public async Task<IActionResult> DeleteVideoChatConversation(Guid id, Guid conversationId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var conversation = await _chatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is null || conversation.VideoId != id)
            return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));

        await _chatMessages.DeleteConversationAsync(conversationId, userId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(BaseResponse<string>.Ok("Conversation deleted."));
    }

}
