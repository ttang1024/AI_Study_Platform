namespace StudyPlatform.Application.Services;

/// <summary>One AI call's token consumption, as reported by the provider.</summary>
public sealed record AiUsageRecord(
    Guid UserId,
    string Provider,
    string Model,
    string Operation,
    int PromptTokens,
    int CompletionTokens,
    int CachedPromptTokens,
    bool Streamed);

/// <summary>
/// Records what each AI call cost. Writes go to their own scope/DbContext so accounting never enlists in the caller's unit of work — a failed insert
/// must not roll back the work the user actually asked for.
/// </summary>
public interface IAiUsageRecorder
{
    /// <summary>Configured daily token budget, shown to the user for reference. Zero means unlimited.</summary>
    long DailyTokenLimit { get; }

    Task RecordAsync(AiUsageRecord usage, CancellationToken cancellationToken = default);

    /// <summary>Tokens the user has consumed since UTC midnight.</summary>
    Task<long> GetTokensUsedTodayAsync(Guid userId, CancellationToken cancellationToken = default);
}
