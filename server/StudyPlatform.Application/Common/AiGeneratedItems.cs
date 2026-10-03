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
