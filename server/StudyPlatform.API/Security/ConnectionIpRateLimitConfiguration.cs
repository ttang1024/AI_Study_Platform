using AspNetCoreRateLimit;
using Microsoft.Extensions.Options;

namespace StudyPlatform.API.Security;

/// <summary>
/// Rate-limits by the connection's address only — never by a client-supplied header.
///
/// <para>The library's default also honours <c>IpRateLimiting:RealIpHeader</c> (X-Real-IP), but behind
/// CloudFront every viewer header reaches the API untouched, so a random X-Real-IP per request bought a
/// fresh rate-limit bucket per request — including on the login and OTP endpoints. The connection address
/// is instead set by <c>UseForwardedHeaders</c> from the X-Forwarded-For entry CloudFront appends itself
/// (see <see cref="ForwardedHeadersSetup"/>), which a client cannot forge.</para>
/// </summary>
public sealed class ConnectionIpRateLimitConfiguration : RateLimitConfiguration
{
    public ConnectionIpRateLimitConfiguration(
        IOptions<IpRateLimitOptions> ipOptions, IOptions<ClientRateLimitOptions> clientOptions)
        : base(ipOptions, clientOptions)
    {
    }

    public override void RegisterResolvers()
    {
        base.RegisterResolvers();
        for (var i = IpResolvers.Count - 1; i >= 0; i--)
        {
            if (IpResolvers[i] is not IpConnectionResolveContributor)
                IpResolvers.RemoveAt(i);
        }
        if (IpResolvers.Count == 0)
            IpResolvers.Add(new IpConnectionResolveContributor());
    }
}
