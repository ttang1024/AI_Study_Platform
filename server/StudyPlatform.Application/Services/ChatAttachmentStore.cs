using System.Text.Json;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Persists chat attachments to blob storage and reconstructs them for clients.
/// Stored metadata (blob key + mime + file name) is serialized into the
/// <c>ChatMessage.AttachmentsJson</c> jsonb column; on read, blob keys are turned
/// into time-limited presigned URLs so thumbnails can be rendered.
/// </summary>
public static class ChatAttachmentStore
{
    // Presigned URL lifetime for rendering thumbnails in chat history.
    private const int UrlExpiryMinutes = 24 * 60;

    private sealed record StoredAttachment(string BlobUrl, string MimeType, string? FileName);

    /// <summary>Uploads attachments and returns the JSON to persist, or null when there are none.</summary>
    public static async Task<string?> SaveAsync(
        IBlobStorageService blob,
        IReadOnlyList<(byte[] data, string mimeType, string? fileName)> attachments,
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (attachments.Count == 0) return null;

        var stored = new List<StoredAttachment>(attachments.Count);
        foreach (var (data, mimeType, fileName) in attachments)
        {
            var key = $"chat-attachments/{userId}/{Guid.NewGuid():N}{ExtensionFor(mimeType)}";
            using var ms = new MemoryStream(data, writable: false);
            var blobUrl = await blob.UploadAsync(ms, key, mimeType, cancellationToken);
            stored.Add(new StoredAttachment(blobUrl, mimeType, fileName));
        }
        return JsonSerializer.Serialize(stored);
    }

    /// <summary>Deserializes stored attachment metadata and returns presigned download URLs.</summary>
    public static async Task<List<ChatMessageAttachmentDto>> LoadAsync(
        IBlobStorageService blob,
        string? attachmentsJson,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(attachmentsJson)) return [];

        List<StoredAttachment>? stored;
        try { stored = JsonSerializer.Deserialize<List<StoredAttachment>>(attachmentsJson); }
        catch { return []; }
        if (stored is null || stored.Count == 0) return [];

        var result = new List<ChatMessageAttachmentDto>(stored.Count);
        foreach (var s in stored)
        {
            string url;
            try { url = await blob.GetSasUrlAsync(s.BlobUrl, UrlExpiryMinutes, cancellationToken); }
            catch { continue; }
            result.Add(new ChatMessageAttachmentDto(url, s.MimeType, s.FileName));
        }
        return result;
    }

    /// <summary>
    /// Projects a stored <see cref="ChatMessage"/> to its DTO, loading any attachments
    /// (as presigned URLs). Messages with no attachments incur no blob calls.
    /// </summary>
    public static async Task<ChatMessageDto> ToDtoAsync(this ChatMessage message, IBlobStorageService blob, CancellationToken cancellationToken)
    {
        var attachments = await LoadAsync(blob, message.AttachmentsJson, cancellationToken);
        return new ChatMessageDto(
            message.MessageId, message.DocumentId, message.VideoId, message.SourceType,
            message.Role, message.Content, message.CreatedAt,
            attachments.Count > 0 ? attachments : null);
    }

    private static string ExtensionFor(string mimeType) => mimeType switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "application/pdf" => ".pdf",
        _ => ".bin",
    };
}
