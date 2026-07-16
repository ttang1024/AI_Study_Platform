using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>Totals across a set of AI calls.</summary>
public record AiUsageTotals(
    int Calls,
    long PromptTokens,
    long CompletionTokens,
    long CachedPromptTokens,
    long TotalTokens,
    decimal EstimatedCostUsd)
{
    public static readonly AiUsageTotals Empty = new(0, 0, 0, 0, 0, 0m);
}

/// <summary>Usage grouped by some key — an operation ("quiz:text") or a model.</summary>
public record AiUsageGroup(string Key, int Calls, long TotalTokens, decimal EstimatedCostUsd);

/// <summary>One day's usage, for the trend chart.</summary>
public record AiUsageDay(DateOnly Date, long TotalTokens, decimal EstimatedCostUsd);

/// <summary>
/// Read side of <see cref="AiUsageLog"/>. Every method aggregates in the database: a heavy user's log is
/// one row per AI call and there is no reason to pull a month of them back to add up six numbers.
/// </summary>
public interface IAiUsageRepository : IRepository<AiUsageLog>
{
    Task<AiUsageTotals> GetTotalsAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);

    /// <summary>Usage per AiService operation ("quiz:text", "chat:document", …), costliest first.</summary>
    Task<IReadOnlyList<AiUsageGroup>> GetByOperationAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);

    /// <summary>Usage per provider/model, costliest first.</summary>
    Task<IReadOnlyList<AiUsageGroup>> GetByModelAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);

    /// <summary>Daily totals over the window, oldest first. Days with no calls are absent, not zero rows.</summary>
    Task<IReadOnlyList<AiUsageDay>> GetDailyAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);
}
