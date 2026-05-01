using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}
