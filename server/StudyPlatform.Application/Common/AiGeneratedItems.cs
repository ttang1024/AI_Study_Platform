using System.Text.Json;

namespace StudyPlatform.Application.Common;

// Shapes for deserializing AI-generated study artifacts from JSON model responses.
// Shared by the document and YouTube-video generation paths (API controllers and
// Application command handlers) so the parsing contract lives in one place.

public record AiFlashcardItem(string Front, string Back, string? Type = null, JsonElement? ChartData = null);

public record AiQuizItem(string Question, string[] Options, string CorrectAnswer, string Explanation);

public record AiGlossaryItem(string Term, string Definition);
