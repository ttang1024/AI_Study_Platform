using System.Text.Json;

namespace StudyPlatform.Application.Common;

// Shapes for deserializing AI-generated study artifacts from JSON model responses.
// Shared by the document and YouTube-video generation paths (API controllers and
// Application command handlers) so the parsing contract lives in one place.
//
// `Quote` is the model's claimed verbatim evidence for the item. It is not trusted: callers pass it
// to SourceAnchorResolver, which either locates it in the real source text or discards it. Null when
// the model omitted it, which the prompt explicitly permits.

public record AiFlashcardItem(
    string Front,
    string Back,
    string? Type = null,
    JsonElement? ChartData = null,
    string? Quote = null);

public record AiQuizItem(
    string Question,
    string[] Options,
    string CorrectAnswer,
    string Explanation,
    string? Quote = null);

public record AiGlossaryItem(string Term, string Definition, string? Quote = null);

public static class AiQuizItems
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

    /// <summary>
    /// The usable questions in a model's quiz answer. Takes a bare array or the first array inside a
    /// wrapper object (<c>{"questions":[…]}</c>), and drops any item missing its question, answer or at
    /// least two options — inserting those failed on NOT NULL or threw in answer normalisation, a 500
    /// that the 30-day result cache then served on every retry.
    /// </summary>
    /// <exception cref="JsonException">Not JSON, no array, or no usable question in it.</exception>
    public static List<AiQuizItem> Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var array = FindArray(document.RootElement) ?? throw new JsonException("Expected a quiz array.");

        var items = (array.Deserialize<List<AiQuizItem?>>(Options) ?? [])
            .Where(q => q != null
                && !string.IsNullOrWhiteSpace(q.Question)
                && !string.IsNullOrWhiteSpace(q.CorrectAnswer)
                && q.Options is { Length: >= 2 })
            .Select(q => q! with { Explanation = q.Explanation ?? string.Empty })
            .ToList();

        return items.Count > 0 ? items : throw new JsonException("No usable quiz questions.");
    }

    private static JsonElement? FindArray(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Array => element,
        JsonValueKind.Object => element.EnumerateObject()
            .Select(p => p.Value)
            .Where(v => v.ValueKind == JsonValueKind.Array)
            .Cast<JsonElement?>()
            .FirstOrDefault(),
        _ => null,
    };
}
