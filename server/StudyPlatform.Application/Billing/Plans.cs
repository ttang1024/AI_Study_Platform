namespace StudyPlatform.Application.Billing;

/// <summary>
/// What a plan entitles its holder to.
///
/// Deliberately a code constant rather than a table. Limits are read on nearly every AI call, so a
/// table would be a join on the hot path; and a plan's limits are part of what was advertised when
/// someone subscribed, which makes them something to change by deploy and review, not by UPDATE.
/// </summary>
public sealed record Plan(
    string Key,
    string DisplayName,
    decimal MonthlyPriceUsd,
    long DailyTokenLimit,
    bool IncludesHostedKeys,
    int MaxClassrooms,
    int MaxStudentsPerClassroom)
{
    /// <summary>Zero means no limit.</summary>
    public bool IsUnlimited(long limit) => limit <= 0;
}

public static class PlanCatalog
{
    public const string FreeKey = "free";
    public const string ProKey = "pro";
    public const string TeamKey = "team";

    /// <summary>
    /// What a user gets with no subscription at all. Its limits are also the fallback whenever the
    /// billing provider is unreachable — losing contact with Stripe must not lock people out of
    /// material they already own.
    /// </summary>
    public static readonly Plan Free = new(
        Key: FreeKey,
        DisplayName: "Free",
        MonthlyPriceUsd: 0m,
        DailyTokenLimit: 100_000,
        IncludesHostedKeys: false,
        MaxClassrooms: 1,
        MaxStudentsPerClassroom: 30);

    public static readonly Plan Pro = new(
        Key: ProKey,
        DisplayName: "Pro",
        MonthlyPriceUsd: 12m,
        DailyTokenLimit: 2_000_000,
        IncludesHostedKeys: true,
        MaxClassrooms: 5,
        MaxStudentsPerClassroom: 100);

    public static readonly Plan Team = new(
        Key: TeamKey,
        DisplayName: "Team",
        MonthlyPriceUsd: 40m,
        DailyTokenLimit: 0, // unlimited
        IncludesHostedKeys: true,
        MaxClassrooms: 0,   // unlimited
        MaxStudentsPerClassroom: 0);

    public static readonly IReadOnlyList<Plan> All = new[] { Free, Pro, Team };

    /// <summary>Resolves a stored plan key. Unknown keys fall back to Free rather than throwing —
    /// a plan that was retired should downgrade its holders, not break their account.</summary>
    public static Plan ByKey(string? key) =>
        All.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase)) ?? Free;
}
