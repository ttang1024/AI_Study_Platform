using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Server-sent streaming endpoints (mindmap, summary, chat) and SSE helpers.
public partial class DocumentsController
{
    /// <summary>
    /// Stream mind map for a document (SSE), saves result to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/mindmap/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamMindMap(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        IAsyncEnumerable<string> stream;
        try
        {
            var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
            stream = bytes != null
                ? _aiService.StreamMindMapAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamMindMapAsync(text!, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return this.AiStreamError(ex);
        }

        return await this.StreamAiToSseAsync(stream, cancellationToken, onCompleted: async (text, ct) =>
        {
            document.MindMapText = text;
            // Built from the file as it stands now, so it is current by definition.
            document.MindMapVersion = document.ContentVersion;
            document.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Documents.Update(document);
            await _unitOfWork.SaveChangesAsync(ct);
        });
    }

    /// <summary>
    /// Stream AI summary for a document (SSE), saves result to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/summary/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamSummary(Guid courseId, Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        IAsyncEnumerable<string> stream;
        try
        {
            var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
            var timelineText = document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
                ? FormatAudioTranscriptForTimeline(text)
                : null;

            stream = timelineText != null
                ? _aiService.StreamTimelineSummaryAsync(timelineText, "audio", cancellationToken)
                : bytes != null
                ? _aiService.StreamSummaryAsync(bytes, document.ContentType, cancellationToken)
                : _aiService.StreamSummaryAsync(text!, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return this.AiStreamError(ex);
        }

        return await this.StreamAiToSseAsync(stream, cancellationToken, onCompleted: async (text, ct) =>
        {
            document.Summary = text;
            // Built from the file as it stands now, so it is current by definition.
            document.SummaryVersion = document.ContentVersion;
            document.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.Documents.Update(document);
            await _unitOfWork.SaveChangesAsync(ct);
        });
    }

    private static string? FormatAudioTranscriptForTimeline(string? transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(transcript);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return null;

            var lines = new List<string>();
            foreach (var chunk in doc.RootElement.EnumerateArray())
            {
                if (!chunk.TryGetProperty("text", out var textElement))
                    continue;

                var text = textElement.GetString();
                if (string.IsNullOrWhiteSpace(text))
                    continue;

                var start = GetDoubleProperty(chunk, "start");
                if (start is null)
                    continue;

                var end = GetDoubleProperty(chunk, "end");
                var timestamp = end is null
                    ? MediaFormatting.FormatTimestamp(start.Value)
                    : $"{MediaFormatting.FormatTimestamp(start.Value)} – {MediaFormatting.FormatTimestamp(end.Value)}";
                lines.Add($"{timestamp} {text.Trim()}");
            }

            return lines.Count > 0 ? string.Join('\n', lines) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static double? GetDoubleProperty(JsonElement element, string name)
        => element.TryGetProperty(name, out var property) && property.TryGetDouble(out var value)
            ? value
            : null;
    /// <summary>
    /// Stream AI chat for a document (SSE), saves messages to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/chat/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamChat(Guid courseId, Guid documentId, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        var attachmentList = request.Attachments?.ToList() ?? [];
        if (string.IsNullOrWhiteSpace(request.Message) && attachmentList.Count == 0)
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        List<(byte[] data, string mimeType, string? fileName)> attachments;
        try
        {
            attachments = ChatAttachments.Decode(attachmentList);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(BaseResponse<string>.Fail(ex.Message, "INVALID_ATTACHMENT"));
        }

        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        // Resolve the thread this turn belongs to. Old clients send no
        // conversation id — continue the latest thread (creating one if none).
        ChatConversation? conversation;
        if (request.ConversationId is { } conversationId)
        {
            conversation = await _unitOfWork.ChatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
            if (conversation is null || conversation.DocumentId != documentId)
                return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));
        }
        else
        {
            await ChatThreads.AdoptLegacyDocumentChatAsync(_unitOfWork, documentId, userId, cancellationToken);
            var existing = await _unitOfWork.ChatMessages.GetConversationsByDocumentIdAsync(documentId, userId, cancellationToken);
            conversation = existing.FirstOrDefault()
                ?? await _unitOfWork.ChatMessages.CreateDocumentConversationAsync(userId, documentId, ChatThreads.DefaultTitle, cancellationToken);
        }

        var promptMessage = ChatAttachments.PromptOrDefault(request.Message);
        var attachmentsJson = await ChatAttachmentStore.SaveAsync(_blobStorageService, attachments, userId, cancellationToken);
        var savedMessage = request.Message ?? string.Empty;

        var history = await _unitOfWork.ChatMessages.GetByConversationIdAsync(conversation.ConversationId, userId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();
        string content;

        try
        {
            var (_, extractedContent) = await _contentService.GetContentAsync(document, cancellationToken);
            content = extractedContent ?? string.Empty;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return this.AiStreamError(ex);
        }

        var stream = _aiService.StreamChatAsync(content, promptMessage, historyTuples, ChatAttachments.ToModelInputs(attachments), cancellationToken);
        return await this.StreamAiToSseAsync(stream, cancellationToken,
            beforeStream: async ct =>
            {
                if (historyTuples.Count == 0 && conversation.Title == ChatThreads.DefaultTitle)
                    conversation.Title = ChatThreads.TitleFrom(promptMessage);
                conversation.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.ChatMessages.UpdateConversation(conversation);
                await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    DocumentId = documentId,
                    ChatConversationId = conversation.ConversationId,
                    SourceType = "document",
                    UserId = userId,
                    Role = "user",
                    Content = savedMessage,
                    AttachmentsJson = attachmentsJson,
                    CreatedAt = DateTime.UtcNow
                }, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            },
            onCompleted: async (text, ct) =>
            {
                conversation.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.ChatMessages.UpdateConversation(conversation);
                await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    DocumentId = documentId,
                    ChatConversationId = conversation.ConversationId,
                    SourceType = "document",
                    UserId = userId,
                    Role = "assistant",
                    Content = text,
                    CreatedAt = DateTime.UtcNow
                }, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            });
    }
}
