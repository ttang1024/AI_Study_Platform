using System.Net;
using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StudyPlatform.API.Security;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class ClientIpResolutionTests
{
    private static async Task<HttpContext> ThroughForwardedHeaders(string forwardedFor, int hops = 1)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Api:ForwardedHops"] = hops.ToString() }).Build();
        var services = new ServiceCollection().AddCloudFrontForwardedHeaders(configuration).BuildServiceProvider();
        var options = services.GetRequiredService<IOptions<ForwardedHeadersOptions>>();
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("130.176.1.1"); // a CloudFront edge
        context.Request.Headers["X-Forwarded-For"] = forwardedFor;
        await new ForwardedHeadersMiddleware(_ => Task.CompletedTask, NullLoggerFactory.Instance, options).Invoke(context);
        return context;
    }

    [Fact]
    public async Task ClientAddress_IsTheEntryCloudFrontAppended_NotTheOneTheClientSent()
    {
        // Viewer sent "1.2.3.4"; CloudFront appended the real viewer address after it.
        var context = await ThroughForwardedHeaders("1.2.3.4, 203.0.113.9");

        Assert.Equal(IPAddress.Parse("203.0.113.9"), context.Connection.RemoteIpAddress);
    }

    [Fact]
    public async Task BehindCaddy_TwoHopsAreTrusted_AndTheClientsOwnEntryIsStillIgnored()
    {
        // Viewer sent "1.2.3.4"; CloudFront appended the viewer; Caddy appended the CloudFront edge.
        var context = await ThroughForwardedHeaders("1.2.3.4, 203.0.113.9, 130.176.1.1", hops: 2);

        Assert.Equal(IPAddress.Parse("203.0.113.9"), context.Connection.RemoteIpAddress);
    }

    [Fact]
    public void RateLimiter_IgnoresXRealIp()
    {
        var config = new ConnectionIpRateLimitConfiguration(
            Options.Create(new IpRateLimitOptions { RealIpHeader = "X-Real-IP" }),
            Options.Create(new ClientRateLimitOptions()));
        config.RegisterResolvers();

        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.9");
        context.Request.Headers["X-Real-IP"] = "6.6.6.6";

        Assert.All(config.IpResolvers, r => Assert.IsType<IpConnectionResolveContributor>(r));
        Assert.Equal("203.0.113.9", config.IpResolvers.Select(r => r.ResolveIp(context)).First(ip => ip != null));
    }

    private static OriginVerificationMiddleware Origin(string? secret, Action? onNext = null)
        => new(_ => { onNext?.Invoke(); return Task.CompletedTask; },
            new ConfigurationBuilder().AddInMemoryCollection(
                new Dictionary<string, string?> { ["Api:OriginVerifySecret"] = secret }).Build());

    [Fact]
    public async Task OriginCheck_WithoutSecretHeader_IsForbidden()
    {
        var reached = false;
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/auth/login";

        await Origin("s3cret", () => reached = true).InvokeAsync(context);

        Assert.Equal(403, context.Response.StatusCode);
        Assert.False(reached);
    }

    [Fact]
    public async Task OriginCheck_WithSecret_PassesAndStripsTheHeader()
    {
        var reached = false;
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/auth/login";
        context.Request.Headers[OriginVerificationMiddleware.HeaderName] = "s3cret";

        await Origin("s3cret", () => reached = true).InvokeAsync(context);

        Assert.True(reached);
        Assert.False(context.Request.Headers.ContainsKey(OriginVerificationMiddleware.HeaderName));
    }

    [Theory]
    [InlineData(null, "/api/x")]      // not configured: no-op
    [InlineData("s3cret", "/health")] // health stays reachable for local probes
    public async Task OriginCheck_Exemptions(string? secret, string path)
    {
        var reached = false;
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        await Origin(secret, () => reached = true).InvokeAsync(context);

        Assert.True(reached);
    }
}
