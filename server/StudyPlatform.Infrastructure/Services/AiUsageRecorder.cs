using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Writes AI usage rows on a scope of its own, so a failure to account for a call can never roll
/// back the call's actual result. The daily total is cached for a minute: the quota gate runs on
/// every AI call and must not add a SUM over the day's rows to each one.
/// </summary>
public class AiUsageRecorder : IAiUsageRecorder
{
    private static readonly TimeSpan DailyTotalCacheTtl = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAppCache _cache;
    private readonly AiUsageOptions _options;
    private readonly ILogger<AiUsageRecorder> _logger;

    public AiUsageRecorder(
        IServiceScopeFactory scopeFactory,
        IAppCache cache,
        IOptions<AiUsageOptions> options,
        ILogger<AiUsageRecorder> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public long DailyTokenLimit => _options.DailyTokenLimit;

    private static string DailyTotalKey(Guid userId) => $"ai-usage:day:{DateTime.UtcNow:yyyy-MM-dd}:{userId}";

    public async Task RecordAsync(AiUsageRecord usage, CancellationToken cancellationToken = default)
    {
        var total = usage.PromptTokens + usage.CompletionTokens;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            db.AiUsageLogs.Add(new AiUsageLog
            {
                AiUsageLogId = Guid.NewGuid(),
                UserId = usage.UserId,
                Provider = usage.Provider,
                Model = usage.Model,
                Operation = usage.Operation,
                PromptTokens = usage.PromptTokens,
                CompletionTokens = usage.CompletionTokens,
                CachedPromptTokens = usage.CachedPromptTokens,
                TotalTokens = total,
                EstimatedCostUsd = EstimateCost(usage),
                Streamed = usage.Streamed,
                CreatedAt = DateTime.UtcNow,
            });

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Accounting is best-effort. Losing a usage row is far better than failing the user's request.
            _logger.LogWarning(ex, "Failed to record AI usage for user {UserId}", usage.UserId);
            return;
        }

        // Keep the cached daily total honest rather than waiting for it to expire, otherwise a burst
        // of calls inside one TTL window could all pass a quota gate the first of them should have closed.
        await _cache.RemoveAsync(DailyTotalKey(usage.UserId), cancellationToken);
    }

    public Task<long> GetTokensUsedTodayAsync(Guid userId, CancellationToken cancellationToken = default)
        => _cache.GetOrCreateAsync(
            DailyTotalKey(userId),
            async ct =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var since = DateTime.UtcNow.Date;
                return await db.AiUsageLogs
                    .AsNoTracking()
                    .Where(u => u.UserId == userId && u.CreatedAt >= since)
                    .SumAsync(u => (long)u.TotalTokens, ct);
            },
            DailyTotalCacheTtl,
            cancellationToken);

    public async Task EnsureWithinQuotaAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        if (_options.DailyTokenLimit <= 0 || userId == Guid.Empty)
            return;

        var used = await GetTokensUsedTodayAsync(userId, cancellationToken);
        if (used >= _options.DailyTokenLimit)
            throw new AiQuotaExceededException(used, _options.DailyTokenLimit);
    }

    /// <summary>
    /// Prices the call from the longest configured model-id prefix that matches. Cache hits are billed
    /// at the configured cached rate, or a tenth of input when the provider's discount isn't spelled out.
    /// </summary>
    private decimal EstimateCost(AiUsageRecord usage)
    {
        var price = _options.Pricing
            .Where(p => usage.Model.StartsWith(p.Key, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.Key.Length)
            .Select(p => p.Value)
            .FirstOrDefault();

        if (price == null)
            return 0m;

        var cached = Math.Min(usage.CachedPromptTokens, usage.PromptTokens);
        var freshPrompt = usage.PromptTokens - cached;
        var cachedRate = price.CachedInputPerMillion ?? price.InputPerMillion / 10m;

        return (freshPrompt * price.InputPerMillion
                + cached * cachedRate
                + usage.CompletionTokens * price.OutputPerMillion) / 1_000_000m;
    }
}
