using Microsoft.AspNetCore.HttpOverrides;

namespace StudyPlatform.API.Security;

/// <summary>
/// Who the client is, behind CloudFront.
///
/// <para>CloudFront appends the viewer's address to X-Forwarded-For, after anything the viewer sent in
/// that header itself, and every proxy after it appends the address it received from. So only the
/// rightmost <c>Api:ForwardedHops</c> entries are trustworthy: 1 when CloudFront talks to the API
/// directly, 2 when a TLS-terminating proxy (Caddy, see deploy.sh API_ORIGIN_TLS) sits between them.
/// <c>ForwardLimit</c> consumes exactly that many and ignores the client-supplied rest. The peers'
/// addresses (CloudFront edges) are many and change, so no proxy allowlist is configured; what keeps a
/// caller from reaching the API directly with a forged header is <see cref="OriginVerificationMiddleware"/>.</para>
/// </summary>
public static class ForwardedHeadersSetup
{
    public static IServiceCollection AddCloudFrontForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
        => services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = Math.Max(1, configuration.GetValue("Api:ForwardedHops", 1));
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });
}
