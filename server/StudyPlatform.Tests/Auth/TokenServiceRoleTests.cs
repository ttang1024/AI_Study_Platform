using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Auth;

// An XSS in the user app must not be able to drive the admin API with an admin's session, so only the
// admin sign-in's token carries the role.
public class TokenServiceRoleTests
{
    private readonly TokenService _service = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = new string('k', 64),
            ["JwtSettings:Issuer"] = "test",
            ["JwtSettings:Audience"] = "test",
        })
        .Build());

    private static User Admin() => new() { UserId = Guid.NewGuid(), Email = "a@b.com", FullName = "A", IsAdmin = true };

    private static IEnumerable<string> Roles(string token)
        => new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Where(c => c.Type == ClaimTypes.Role || c.Type == "role")
            .Select(c => c.Value);

    [Fact]
    public void UserAppToken_ForAnAdmin_HasNoAdminRole()
        => Assert.DoesNotContain("Admin", Roles(_service.GenerateAccessToken(Admin())));

    [Fact]
    public void AdminToken_ForAnAdmin_HasTheAdminRole()
        => Assert.Contains("Admin", Roles(_service.GenerateAdminAccessToken(Admin())));

    [Fact]
    public void AdminToken_ForANonAdmin_HasNoAdminRole()
    {
        var user = Admin();
        user.IsAdmin = false;
        Assert.DoesNotContain("Admin", Roles(_service.GenerateAdminAccessToken(user)));
    }
}
