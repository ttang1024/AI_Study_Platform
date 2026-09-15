using StudyPlatform.Application.Auth;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class AuthTokenLifetimesTests
{
    [Fact]
    public void AccessToken_MatchesTheConfiguredFifteenMinutes()
        => Assert.Equal(TimeSpan.FromMinutes(15), AuthTokenLifetimes.AccessToken);

    [Fact]
    public void RefreshToken_MatchesTheConfiguredSevenDays()
        => Assert.Equal(TimeSpan.FromDays(7), AuthTokenLifetimes.RefreshToken);

    [Fact]
    public void RefreshTokenOutlivesTheAccessToken()
        => Assert.True(AuthTokenLifetimes.RefreshToken > AuthTokenLifetimes.AccessToken);

    [Fact]
    public void RefreshTokenFactory_DatesTheRowFromTheSharedRefreshLifetime()
    {
        var before = DateTime.UtcNow;

        var token = RefreshTokenFactory.Create(Guid.NewGuid(), "value");

        Assert.InRange(
            token.ExpiresAt,
            before.Add(AuthTokenLifetimes.RefreshToken),
            DateTime.UtcNow.Add(AuthTokenLifetimes.RefreshToken));
    }
}
