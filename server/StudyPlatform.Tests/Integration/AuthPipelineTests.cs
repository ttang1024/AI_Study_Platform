using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// Authentication and authorization as a request actually meets them: the real middleware order, the
/// JwtBearer validation parameters and the role checks. AuthorizationInventoryTests proves every endpoint
/// declares a policy; this proves the declared policies are enforced.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AuthPipelineTests : IDisposable
{
    private const string SigningKey = "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk";
    private readonly WebApplicationFactory<Program> _api;

    public AuthPipelineTests(PostgresFixture db)
    {
        _api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", db.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", SigningKey);
            builder.UseSetting("Redis:Enabled", "false");
            builder.UseSetting("S3:BucketName", "auth-pipeline");
        });
    }

    public void Dispose() => _api.Dispose();

    private static User Person(bool isAdmin = false) => new() { UserId = Guid.NewGuid(), Email = "p@example.com", FullName = "P", IsAdmin = isAdmin };

    private string UserToken(User? user = null) => _api.Services.GetRequiredService<ITokenService>().GenerateAccessToken(user ?? Person());

    private string AdminToken(User user) => _api.Services.GetRequiredService<ITokenService>().GenerateAdminAccessToken(user);

    /// <summary>A token signed with the real key but otherwise shaped by the test.</summary>
    private string Forge(DateTime? expires = null, string? audience = null, string key = SigningKey)
    {
        var config = _api.Services.GetRequiredService<IConfiguration>();
        var token = new JwtSecurityToken(
            issuer: config["JwtSettings:Issuer"],
            audience: audience ?? config["JwtSettings:Audience"],
            claims: [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())],
            notBefore: DateTime.UtcNow.AddHours(-2),
            expires: expires ?? DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<HttpResponseMessage> Get(string path, string? bearer = null)
    {
        var client = _api.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (bearer != null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return await client.SendAsync(request);
    }

    [DockerFact]
    public async Task ValidUserToken_ReachesAnAuthenticatedEndpoint()
        => Assert.Equal(HttpStatusCode.OK, (await Get("/api/courses", UserToken())).StatusCode);

    [DockerFact]
    public async Task NoToken_Is401()
        => Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/courses")).StatusCode);

    [DockerFact]
    public async Task ExpiredToken_Is401_AndSaysSoForTheSilentRefresh()
    {
        // The clients refresh on this header; without it an expired session looks like a sign-out.
        var response = await Get("/api/courses", Forge(expires: DateTime.UtcNow.AddMinutes(-1)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.TryGetValues("Token-Expired", out var values) && values.Single() == "true");
    }

    [DockerFact]
    public async Task TokenSignedWithAnotherKey_Is401_WithoutTheExpiredHint()
    {
        var response = await Get("/api/courses", Forge(key: new string('x', 64)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.False(response.Headers.Contains("Token-Expired"));
    }

    [DockerFact]
    public async Task TokenForAnotherAudience_Is401()
        => Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/courses", Forge(audience: "some-other-app"))).StatusCode);

    [DockerFact]
    public async Task TamperedPayload_Is401()
    {
        var parts = UserToken().Split('.');
        var claims = Encoding.UTF8.GetString(Base64UrlEncoder.DecodeBytes(parts[1]))
            .Replace("\"exp\":", "\"role\":\"Admin\",\"exp\":");
        var tampered = $"{parts[0]}.{Base64UrlEncoder.Encode(claims)}.{parts[2]}";

        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/feedback/stats", tampered)).StatusCode);
    }

    [DockerFact]
    public async Task UserAppToken_OfAnAdmin_IsForbiddenOnTheAdminApi()
    {
        // The user app's token never carries the role, so an XSS there cannot drive the admin API.
        var admin = Person(isAdmin: true);

        Assert.Equal(HttpStatusCode.Forbidden, (await Get("/api/admin/feedback/stats", UserToken(admin))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Get("/api/admin/feedback/stats", AdminToken(admin))).StatusCode);
    }

    [DockerFact]
    public async Task AdminSignIn_OfANonAdmin_GetsNoRole()
        => Assert.Equal(HttpStatusCode.Forbidden, (await Get("/api/admin/feedback/stats", AdminToken(Person()))).StatusCode);

    [DockerFact]
    public async Task QueryStringToken_IsOnlyHonouredForTheHub()
    {
        // Tokens in URLs end up in logs and Referer headers; the API reads them only where a header is
        // impossible (the SignalR handshake).
        var token = UserToken();

        Assert.Equal(HttpStatusCode.Unauthorized, (await Get($"/api/courses?access_token={token}")).StatusCode);
        var negotiate = await _api.CreateClient().PostAsync($"/hubs/group-chat/negotiate?negotiateVersion=1&access_token={token}", null);
        Assert.Equal(HttpStatusCode.OK, negotiate.StatusCode);
        var anonymous = await _api.CreateClient().PostAsync("/hubs/group-chat/negotiate?negotiateVersion=1", null);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [DockerFact]
    public async Task MediaEndpoint_RejectsAnExpiredQueryToken()
    {
        // <video> cannot send headers, so this endpoint validates ?access_token= itself — with the same
        // rules as the bearer handler, expiry included.
        var response = await Get($"/api/videos/{Guid.NewGuid()}/file?access_token={Forge(expires: DateTime.UtcNow.AddMinutes(-1))}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [DockerFact]
    public async Task OriginSecretConfigured_RequestsBypassingTheCdn_AreRefused()
    {
        using var guarded = _api.WithWebHostBuilder(b => b.UseSetting("Api:OriginVerifySecret", "cdn-secret"));
        var client = guarded.CreateClient();

        var direct = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, "/api/courses")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", UserToken()) },
        });
        var viaCdn = new HttpRequestMessage(HttpMethod.Get, "/api/courses")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", UserToken()) },
        };
        viaCdn.Headers.Add("X-Origin-Verify", "cdn-secret");

        Assert.Equal(HttpStatusCode.Forbidden, direct.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(viaCdn)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode); // probes stay open
    }
}
