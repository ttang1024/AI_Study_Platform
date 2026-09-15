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
/// back the call's actual result.
/// </summary>
public class AiUsageRecorder : IAiUsageRecorder
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AiUsageOptions _options;
    private readonly ILogger<AiUsageRecorder> _logger;

    public AiUsageRecorder(
        IServiceScopeFactory scopeFactory,
        IOptions<AiUsageOptions> options,
        ILogger<AiUsageRecorder> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

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
        }
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
