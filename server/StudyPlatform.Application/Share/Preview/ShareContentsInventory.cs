using System.Text.Json;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Share.Preview;

/// <inheritdoc />
public class ShareContentsInventory : IShareContentsInventory
{
    public string Describe(ShareToken share)
    {
        var parts = new List<string>(6);

        if (!string.IsNullOrWhiteSpace(share.Summary)) parts.Add("summary");
        if (!string.IsNullOrWhiteSpace(share.MindMapText)) parts.Add("mind map");
        if (!string.IsNullOrWhiteSpace(share.NotesHtml))
            parts.Add(string.Equals(share.SourceType, "chat", StringComparison.OrdinalIgnoreCase) ? "conversation" : "notes");

        Add(parts, CountItems(share.FlashcardsJson), "flashcard", "flashcards");
        Add(parts, CountItems(share.QuizzesJson), "quiz question", "quiz questions");
        Add(parts, CountItems(share.GlossaryJson), "glossary term", "glossary terms");

        if (parts.Count == 0) return string.Empty;

        var sentence = string.Join(", ", parts);
        return char.ToUpperInvariant(sentence[0]) + sentence[1..];
    }

    private static void Add(List<string> parts, int count, string singular, string plural)
    {
        if (count > 0) parts.Add($"{count} {(count == 1 ? singular : plural)}");
    }

    /// <summary>
    /// The collections are stored as the JSON the client stringified, so a malformed or
    /// unexpectedly shaped blob means "nothing to count", never a failed preview.
    /// </summary>
    private static int CountItems(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return 0;

        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Array
                ? document.RootElement.GetArrayLength()
                : 0;
        }
        catch (JsonException)
        {
            return 0;
        }
    }
}
