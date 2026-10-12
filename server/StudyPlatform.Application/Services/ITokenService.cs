using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

public interface ITokenService
{
    /// <summary>An access token for the user-facing apps. Never carries the Admin role.</summary>
    string GenerateAccessToken(User user);

    /// <summary>An access token carrying the Admin role, minted only by the admin sign-in.</summary>
    string GenerateAdminAccessToken(User user);
    string GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}
