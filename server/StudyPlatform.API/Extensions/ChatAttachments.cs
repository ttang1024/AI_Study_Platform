using StudyPlatform.Application.Documents.DTOs;

namespace StudyPlatform.API.Extensions;

/// <summary>
/// Shared helpers for handling image/PDF attachments on chat turns: validation,
/// base64 decoding, and building the persisted user-message text (with a marker
/// per attachment so reloaded history shows attachments existed).
/// </summary>
public static class ChatAttachments
{
    private const int MaxChatAttachments = 8;
    private const int MaxChatAttachmentBytes = 20 * 1024 * 1024; // 20 MB decoded
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "application/pdf",
    };

    /// <summary>Validates and decodes chat attachments. Throws <see cref="ArgumentException"/> on invalid input.</summary>
    public static List<(byte[] data, string mimeType, string? fileName)> Decode(IEnumerable<ChatAttachmentDto>? attachments)
    {
        var list = attachments?.ToList() ?? [];
        if (list.Count == 0) return [];
        if (list.Count > MaxChatAttachments)
            throw new ArgumentException($"A maximum of {MaxChatAttachments} attachments is allowed per message.");

        var result = new List<(byte[], string, string?)>(list.Count);
        foreach (var a in list)
        {
            var mime = (a.MimeType ?? string.Empty).Trim().ToLowerInvariant();
            if (mime == "image/jpg") mime = "image/jpeg";
            if (!AllowedMimeTypes.Contains(mime))
                throw new ArgumentException($"Unsupported attachment type: {a.MimeType}. Allowed: images and PDF.");

            // Tolerate a data: URL prefix in case the client forwards one.
            var raw = a.Data ?? string.Empty;
            var commaIdx = raw.IndexOf(',');
            if (raw.StartsWith("data:") && commaIdx >= 0)
                raw = raw[(commaIdx + 1)..];

            byte[] bytes;
            try { bytes = Convert.FromBase64String(raw); }
            catch (FormatException) { throw new ArgumentException("Attachment data is not valid base64."); }

            if (bytes.Length == 0)
                throw new ArgumentException("Attachment is empty.");
            if (bytes.Length > MaxChatAttachmentBytes)
                throw new ArgumentException("Attachment exceeds the 20 MB size limit.");

            result.Add((bytes, mime, string.IsNullOrWhiteSpace(a.FileName) ? null : a.FileName.Trim()));
        }
        return result;
    }

    /// <summary>Projects decoded attachments down to the (data, mime) tuples the AI service consumes.</summary>
    public static List<(byte[] data, string mimeType)> ToModelInputs(
        IReadOnlyList<(byte[] data, string mimeType, string? fileName)> attachments)
        => attachments.Select(a => (a.data, a.mimeType)).ToList();

    /// <summary>An attachment-only turn still needs a textual instruction for the model.</summary>
    public static string PromptOrDefault(string? message)
        => string.IsNullOrWhiteSpace(message) ? "Please look at the attached file(s)." : message;
}
