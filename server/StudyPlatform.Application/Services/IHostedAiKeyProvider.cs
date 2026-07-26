namespace StudyPlatform.Application.Services;

/// <summary>
/// Supplies a server-held AI key for users whose plan includes one.
///
/// <para>Resolution is synchronous by design. AiService picks credentials on the hot path of every
/// call and cannot await there, so the caller's entitlement is resolved once per request by
/// <c>EntitlementsMiddleware</c> and stashed on the HttpContext; this reads that. A request that
/// never passed through the middleware (a background job) simply gets no hosted key, and the job's
/// captured AmbientAiCredentials apply instead.</para>
/// </summary>
public interface IHostedAiKeyProvider
{
    /// <summary>True when this deployment has a hosted key configured at all.</summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Credentials to lend to the current caller, or null when there is no hosted key, the caller's
    /// plan does not include one, or there is no request context to judge from.
    /// </summary>
    AiCredentials? TryGetForCurrentRequest();
}
