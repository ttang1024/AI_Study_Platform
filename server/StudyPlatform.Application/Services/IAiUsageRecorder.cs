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
/// Records what each AI call cost and enforces the per-user daily token budget. Writes go to their
/// own scope/DbContext so accounting never enlists in the caller's unit of work — a failed insert
/// must not roll back the work the user actually asked for.
/// </summary>
public interface IAiUsageRecorder
{
    /// <summary>Tokens a user may spend per UTC day. Zero means unlimited.</summary>
    long DailyTokenLimit { get; }

    Task RecordAsync(AiUsageRecord usage, CancellationToken cancellationToken = default);

    /// <summary>Tokens the user has consumed since UTC midnight.</summary>
    Task<long> GetTokensUsedTodayAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Throws <see cref="AiQuotaExceededException"/> when the user has spent their daily budget.
    /// No-op when no budget is configured, or when the call can't be attributed to a user.
    /// </summary>
    Task EnsureWithinQuotaAsync(Guid userId, CancellationToken cancellationToken = default);
}
