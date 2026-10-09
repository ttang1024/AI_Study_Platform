using Microsoft.Extensions.Configuration;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Security;

/// <summary>
/// ValidateAccessToken backs the <c>?access_token=</c> media endpoints, so it must accept exactly what
/// the JwtBearer handler accepts — not any token signed with the same key.
/// </summary>
public class TokenServiceValidationTests
{
    private const string Key = "0123456789abcdef0123456789abcdef0123456789abcdef";

    private static TokenService Service(string audience) => new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = Key,
            ["JwtSettings:Issuer"] = "StudyPlatform",
            ["JwtSettings:Audience"] = audience,
        }).Build());

    private static readonly User User = new() { UserId = Guid.NewGuid(), Email = "u@x.io", FullName = "U" };

    [Fact]
    public void OwnToken_IsAccepted()
    {
        var service = Service("StudyPlatformUsers");
        Assert.Equal(User.UserId, service.ValidateAccessToken(service.GenerateAccessToken(User)));
    }

    [Fact]
    public void TokenForAnotherAudience_IsRejected()
    {
        var foreign = Service("SomeOtherApp").GenerateAccessToken(User);
        Assert.Null(Service("StudyPlatformUsers").ValidateAccessToken(foreign));
    }
}
