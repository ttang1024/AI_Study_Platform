namespace StudyPlatform.Application.Settings;

public class AiUsageOptions
{
    public const string SectionName = "AiUsage";

    /// <summary>Tokens a single user may spend per UTC day. Zero (the default) means unlimited.</summary>
    public long DailyTokenLimit { get; set; }

    /// <summary>
    /// USD per million tokens, keyed by a case-insensitive model-id prefix ("gpt-4o", "claude-sonnet").
    /// The longest matching prefix wins; an unpriced model logs tokens with a zero cost estimate.
    /// </summary>
    public Dictionary<string, ModelPrice> Pricing { get; set; } = new();
}

public class ModelPrice
{
    public decimal InputPerMillion { get; set; }
    public decimal OutputPerMillion { get; set; }

    /// <summary>Rate for prompt-cache hits. Providers discount these heavily; defaults to a tenth of input.</summary>
    public decimal? CachedInputPerMillion { get; set; }
}
