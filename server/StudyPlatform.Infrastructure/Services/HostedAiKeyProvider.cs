using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

public class HostedAiKeyProvider : IHostedAiKeyProvider
{
    /// <summary>
    /// HttpContext.Items key under which EntitlementsMiddleware leaves the caller's resolved plan.
    /// Shared with the middleware so the contract is stated in one place.
    /// </summary>
    public const string EntitlementItemKey = "StudyPlatform.Entitlement";

    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly HostedAiOptions _options;

    public HostedAiKeyProvider(IHttpContextAccessor httpContextAccessor, IOptions<HostedAiOptions> options)
    {
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ApiKey)
        && !string.IsNullOrWhiteSpace(_options.Provider)
        && !string.IsNullOrWhiteSpace(_options.Model);

    public AiCredentials? TryGetForCurrentRequest()
    {
        if (!IsConfigured) return null;

        var context = _httpContextAccessor.HttpContext;
        if (context == null) return null;

        if (context.Items[EntitlementItemKey] is not Entitlement entitlement) return null;
        if (!entitlement.Plan.IncludesHostedKeys) return null;

        var claim = context.User?.FindFirst("sub")?.Value
                    ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claim, out var userId)) return null;

        return new AiCredentials(
            _options.Provider!.ToLowerInvariant(), _options.Model!, _options.ApiKey!, userId);
    }
}
