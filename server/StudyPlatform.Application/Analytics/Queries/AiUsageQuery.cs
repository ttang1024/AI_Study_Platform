using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record AiUsageTotalsDto(
    int Calls,
    long PromptTokens,
    long CompletionTokens,
    long CachedPromptTokens,
    long TotalTokens,
    decimal EstimatedCostUsd);

public record AiUsageGroupDto(string Key, int Calls, long TotalTokens, decimal EstimatedCostUsd);

public record AiUsageDayDto(DateOnly Date, long TotalTokens, decimal EstimatedCostUsd);

/// <param name="DailyTokenLimit">Tokens allowed per UTC day. Zero means unlimited.</param>
/// <param name="TokensUsedToday">Spend against that limit so far today, so the UI can show headroom.</param>
public record AiUsageDto(
    DateOnly From,
    DateOnly To,
    AiUsageTotalsDto Totals,
    IReadOnlyList<AiUsageGroupDto> ByOperation,
    IReadOnlyList<AiUsageGroupDto> ByModel,
    IReadOnlyList<AiUsageDayDto> Daily,
    long DailyTokenLimit,
    long TokensUsedToday);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// What this user's AI calls have cost them, broken down by feature and model.
///
/// Users bring their own provider keys, so this spend lands on their bill, not ours — which makes
/// "where did my tokens go" a question only they can answer, and only if we show them. The numbers come
/// from <c>AiUsageLog</c>, which the recorder already writes on every call; nothing new is collected.
/// Cost is the recorder's best-effort estimate from the configured per-million rates, so it is a guide,
/// not an invoice.
/// </summary>
public record GetAiUsageQuery(Guid UserId, DateOnly? From, DateOnly? To) : IRequest<Result<AiUsageDto>>;

public class GetAiUsageQueryHandler : IRequestHandler<GetAiUsageQuery, Result<AiUsageDto>>
{
    /// <summary>Default window when the caller does not pick one.</summary>
    private const int DefaultDays = 30;

    /// <summary>A long window is fine — it all aggregates in SQL — but an unbounded one is not.</summary>
    private const int MaxDays = 366;

    private readonly IUnitOfWork _unitOfWork;
    private readonly AiUsageOptions _options;

    public GetAiUsageQueryHandler(IUnitOfWork unitOfWork, IOptions<AiUsageOptions> options)
    {
        _unitOfWork = unitOfWork;
        _options = options.Value;
    }

    public async Task<Result<AiUsageDto>> Handle(GetAiUsageQuery request, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var to = request.To ?? today;
        var from = request.From ?? to.AddDays(-(DefaultDays - 1));

        if (from > to)
            return Result<AiUsageDto>.Failure("'from' must not be after 'to'.", "INVALID_DATE_RANGE");

        if (to.DayNumber - from.DayNumber + 1 > MaxDays)
            return Result<AiUsageDto>.Failure($"Range must be {MaxDays} days or fewer.", "RANGE_TOO_LARGE");

        // Half-open [fromUtc, toUtc): the window must include everything logged on the 'to' day itself.
        var fromUtc = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toUtc = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var totals = await _unitOfWork.AiUsage.GetTotalsAsync(request.UserId, fromUtc, toUtc, ct);
        var byOperation = await _unitOfWork.AiUsage.GetByOperationAsync(request.UserId, fromUtc, toUtc, ct);
        var byModel = await _unitOfWork.AiUsage.GetByModelAsync(request.UserId, fromUtc, toUtc, ct);
        var daily = await _unitOfWork.AiUsage.GetDailyAsync(request.UserId, fromUtc, toUtc, ct);

        // Today's spend is what the quota gate actually meters, so read it for the UTC day regardless of
        // the window the user is looking at — otherwise the headroom shown would depend on the date filter.
        var todayStart = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var todayTotals = await _unitOfWork.AiUsage.GetTotalsAsync(
            request.UserId, todayStart, todayStart.AddDays(1), ct);

        return Result<AiUsageDto>.Success(new AiUsageDto(
            from,
            to,
            new AiUsageTotalsDto(
                totals.Calls,
                totals.PromptTokens,
                totals.CompletionTokens,
                totals.CachedPromptTokens,
                totals.TotalTokens,
                totals.EstimatedCostUsd),
            byOperation.Select(g => new AiUsageGroupDto(g.Key, g.Calls, g.TotalTokens, g.EstimatedCostUsd)).ToList(),
            byModel.Select(g => new AiUsageGroupDto(g.Key, g.Calls, g.TotalTokens, g.EstimatedCostUsd)).ToList(),
            daily.Select(d => new AiUsageDayDto(d.Date, d.TotalTokens, d.EstimatedCostUsd)).ToList(),
            _options.DailyTokenLimit,
            todayTotals.TotalTokens));
    }
}
