using StudyPlatform.Domain.Interfaces;
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
    public Task<IActionResult> StreamMindMap(Guid courseId, Guid documentId, CancellationToken cancellationToken)
        => StreamDocumentAi(ct => _documentAi.StreamMindMapAsync(documentId, User.GetUserId(), ct), cancellationToken);

    /// <summary>
    /// Stream AI summary for a document (SSE), saves result to DB on completion
    /// </summary>
    [HttpPost("{documentId:guid}/summary/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public Task<IActionResult> StreamSummary(Guid courseId, Guid documentId, CancellationToken cancellationToken)
        => StreamDocumentAi(ct => _documentAi.StreamSummaryAsync(documentId, User.GetUserId(), ct), cancellationToken);

    private async Task<IActionResult> StreamDocumentAi(
        Func<CancellationToken, Task<Result<AiTextStream>>> start, CancellationToken cancellationToken)
    {
        Result<AiTextStream> result;
        try
        {
            result = await start(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            // Reading the document (blob storage, text extraction) failed before any SSE was written.
            return this.AiStreamError(ex);
        }

        return result.IsSuccess
            ? await this.WriteAiTextStreamAsync(result.Data!, cancellationToken)
            : NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));
    }

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
        if (ChatAttachments.TryDecodeTurn(request.Attachments, request.Message, out _, out var attachments) is { } invalid)
            return invalid;

        var userId = User.GetUserId();
        var document = await _documents.GetOwnedAsync(documentId, userId, cancellationToken);
        if (document == null)
            return NotFound(BaseResponse<string>.Fail("Document not found.", "DOCUMENT_NOT_FOUND"));

        // Resolve the thread this turn belongs to. Old clients send no
        // conversation id — continue the latest thread (creating one if none).
        ChatConversation? conversation;
        if (request.ConversationId is { } conversationId)
        {
            conversation = await _chatMessages.GetConversationAsync(conversationId, userId, cancellationToken);
            if (conversation is null || conversation.DocumentId != documentId)
                return NotFound(BaseResponse<string>.Fail("Conversation not found.", "CONVERSATION_NOT_FOUND"));
        }
        else
        {
            await ChatThreads.AdoptLegacyDocumentChatAsync(_chatMessages, _unitOfWork, documentId, userId, cancellationToken);
            var existing = await _chatMessages.GetConversationsByDocumentIdAsync(documentId, userId, cancellationToken);
            conversation = existing.FirstOrDefault()
                ?? await _chatMessages.CreateDocumentConversationAsync(userId, documentId, ChatThreads.DefaultTitle, cancellationToken);
        }

        var promptMessage = ChatAttachments.PromptOrDefault(request.Message);
        var attachmentsJson = await ChatAttachmentStore.SaveAsync(_blobStorageService, attachments, userId, cancellationToken);
        var savedMessage = request.Message ?? string.Empty;

        var history = await _chatMessages.GetByConversationIdAsync(conversation.ConversationId, userId, cancellationToken);
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
        var thread = new ChatThread(userId, conversation, "document", DocumentId: documentId);
        return await this.StreamAiToSseAsync(stream, cancellationToken,
            beforeStream: ct => _chatTurns.RecordUserAsync(
                thread,
                savedMessage,
                attachmentsJson,
                // A thread still carrying the placeholder title takes its name from this first turn.
                historyTuples.Count == 0 && conversation.Title == ChatThreads.DefaultTitle
                    ? ChatThreads.TitleFrom(promptMessage)
                    : null,
                ct),
            onCompleted: (text, ct) => _chatTurns.RecordAssistantAsync(thread, text, ct),
            onInterrupted: (partial, ct) => _chatTurns.RecordAssistantAsync(thread, ChatThreads.InterruptedReply(partial), ct));
    }
}
