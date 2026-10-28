using System.Text.Json;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Share;

/// <summary>
/// What a share's <c>SourceUrl</c> points at, and how its notes are made safe to render — shared by
/// creating a share and by the anonymous endpoints that serve one.
/// </summary>
public static class ShareSources
{
    /// <summary>A document path: <c>{anything}/{documentId}</c>.</summary>
    public static bool TryParseDocPath(string sourceUrl, out Guid docId)
    {
        docId = Guid.Empty;
        var parts = sourceUrl.Split('/');
        return parts.Length == 2 && Guid.TryParse(parts[1], out docId);
    }

    /// <summary>An uploaded-video path: <c>video/{videoId}</c>.</summary>
    public static bool TryParseVideoPath(string sourceUrl, out Guid videoId)
    {
        videoId = Guid.Empty;
        var parts = sourceUrl.Split('/');
        return parts.Length == 2 && parts[0] == "video" && Guid.TryParse(parts[1], out videoId);
    }

    /// <summary>
    /// Notes are rendered as HTML by every client, so they are sanitized — except a chat share's JSON
    /// transcript, which clients render as plain text / Markdown and which HTML-encoding would corrupt.
    /// The exemption matches exactly the shape clients route to their transcript renderer (source type
    /// "chat" and a <c>chat-transcript</c> payload); anything else is treated as HTML.
    /// </summary>
    public static string? SanitizeNotes(IRichTextSanitizer sanitizer, string? notes, string? sourceType)
    {
        if (string.IsNullOrWhiteSpace(notes) || (sourceType == "chat" && IsChatTranscriptJson(notes)))
            return notes;
        return sanitizer.Sanitize(notes);
    }

    private static bool IsChatTranscriptJson(string value)
    {
        if (!value.TrimStart().StartsWith('{'))
            return false;
        try
        {
            using var doc = JsonDocument.Parse(value);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("type", out var type)
                && type.ValueKind == JsonValueKind.String
                && type.GetString() == "chat-transcript";
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
