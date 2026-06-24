namespace StudyPlatform.Infrastructure.Services;

/// <summary>Strips code fences and isolates/cleans the JSON or text payload from an LLM response.</summary>
internal static class AiResponseParsing
{
    public static string CleanJsonResponse(string text)
    {
        text = text.Trim();
        if (text.StartsWith("```json")) text = text[7..];
        else if (text.StartsWith("```")) text = text[3..];
        if (text.EndsWith("```")) text = text[..^3];
        text = text.Trim();

        var objStart = text.IndexOf('{');
        var arrStart = text.IndexOf('[');
        var jsonStart = (objStart, arrStart) switch
        {
            ( >= 0, >= 0) => Math.Min(objStart, arrStart),
            ( >= 0, _) => objStart,
            (_, >= 0) => arrStart,
            _ => -1
        };
        if (jsonStart >= 0) text = text[jsonStart..];

        var jsonEnd = FindJsonEnd(text);
        if (jsonEnd > 0) text = text[..jsonEnd];

        return text.Trim();
    }

    public static string CleanTextResponse(string text)
    {
        text = text.Trim();
        if (text.StartsWith("```"))
        {
            var firstNewline = text.IndexOf('\n');
            if (firstNewline >= 0) text = text[(firstNewline + 1)..];
        }
        if (text.EndsWith("```")) text = text[..^3];
        return text.Trim();
    }

    public static int FindJsonEnd(string text)
    {
        if (text.Length == 0) return -1;
        char open = text[0];
        char close = open == '{' ? '}' : open == '[' ? ']' : '\0';
        if (close == '\0') return -1;

        int depth = 0;
        bool inString = false, escaped = false;
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (escaped) { escaped = false; continue; }
            if (c == '\\' && inString) { escaped = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == open) depth++;
            else if (c == close) { depth--; if (depth == 0) return i + 1; }
        }
        return -1;
    }

    public static string TruncateContent(string content, int maxLength = 10000)
        => content.Length <= maxLength ? content : content[..maxLength] + "\n[Source truncated...]";
}
