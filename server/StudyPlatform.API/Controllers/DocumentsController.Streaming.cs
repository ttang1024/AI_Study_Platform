using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

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

        var fullText = new StringBuilder();
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
            return this.AiStreamError(ex);
        }

        Response.SetSseHeaders();

        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
            {
                document.MindMapText = fullText.ToString();
                document.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Documents.Update(document);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
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

        var fullText = new StringBuilder();
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
            return this.AiStreamError(ex);
        }

        Response.SetSseHeaders();

        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            // Persist the streamed summary
            if (fullText.Length > 0)
            {
                document.Summary = fullText.ToString();
                document.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.Documents.Update(document);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
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

        var promptMessage = ChatAttachments.PromptOrDefault(request.Message);
        var attachmentsJson = await ChatAttachmentStore.SaveAsync(_blobStorageService, attachments, userId, cancellationToken);
        var savedMessage = request.Message ?? string.Empty;

        var history = await _unitOfWork.ChatMessages.GetByDocumentIdAsync(documentId, userId, cancellationToken);
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
            return this.AiStreamError(ex);
        }

        await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            DocumentId = documentId,
            SourceType = "document",
            UserId = userId,
            Role = "user",
            Content = savedMessage,
            AttachmentsJson = attachmentsJson,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        Response.SetSseHeaders();

        var fullResponse = new StringBuilder();
        try
        {
            fullResponse.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullResponse.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            // Save model message
            if (fullResponse.Length > 0)
            {
                var assistantMsg = new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    DocumentId = documentId,
                    SourceType = "document",
                    UserId = userId,
                    Role = "assistant",
                    Content = fullResponse.ToString(),
                    CreatedAt = DateTime.UtcNow
                };
                await _unitOfWork.ChatMessages.AddAsync(assistantMsg, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }
}
