namespace StudyPlatform.Domain.Entities;

/// <summary>One row per AI provider call: what it was for, and what it cost in tokens.</summary>
public class AiUsageLog
{
    public Guid AiUsageLogId { get; set; }
    public Guid UserId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;

    /// <summary>The AiService method that made the call, e.g. "quiz:text" or "chat:document".</summary>
    public string Operation { get; set; } = string.Empty;

    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }

    /// <summary>Prompt tokens served from the provider's prompt cache — billed at a discount, if at all.</summary>
    public int CachedPromptTokens { get; set; }

    public int TotalTokens { get; set; }

    /// <summary>Best-effort estimate from the model's published per-million-token rates. Zero when the model is unpriced.</summary>
    public decimal EstimatedCostUsd { get; set; }

    public bool Streamed { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
