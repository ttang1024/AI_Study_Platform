namespace StudyPlatform.Application.Common;

/// <summary>
/// How sure the learner was when they answered. Three levels on purpose: asking for a percentage makes
/// people deliberate about the number instead of the question, and the signal we actually want is coarse.
/// </summary>
public static class ConfidenceLevel
{
    public const int Guessing = 1;
    public const int Unsure = 2;
    public const int Confident = 3;

    public static bool IsValid(int level) => level is >= Guessing and <= Confident;

    public static string Label(int level) => level switch
    {
        Guessing => "Guessing",
        Unsure => "Unsure",
        Confident => "Confident",
        _ => "Unknown",
    };
}

/// <summary>Reads and writes the <c>ConfidenceJson</c> column.</summary>
public static class ConfidenceSerializer
{
    /// <summary>
    /// Null when there is nothing worth storing. Out-of-range levels are dropped rather than clamped:
    /// a client sending 7 is confused, and guessing what it meant would poison the calibration data.
    /// </summary>
    public static string? Serialize(Dictionary<string, int>? confidence)
    {
        if (confidence == null || confidence.Count == 0)
            return null;

        var valid = confidence
            .Where(kv => ConfidenceLevel.IsValid(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        return valid.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(valid);
    }

    /// <summary>Empty for submissions predating confidence capture, or for malformed stored JSON.</summary>
    public static IReadOnlyDictionary<string, int> Deserialize(string? confidenceJson)
    {
        if (string.IsNullOrWhiteSpace(confidenceJson))
            return new Dictionary<string, int>();

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, int>>(confidenceJson)
                   ?? new Dictionary<string, int>();
        }
        catch (System.Text.Json.JsonException)
        {
            return new Dictionary<string, int>();
        }
    }
}
