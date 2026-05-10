namespace StudyPlatform.Application.Services;

public interface IOAuthService
{
    Task<OAuthUserInfo?> GetUserInfoAsync(string provider, string code, string redirectUri, CancellationToken cancellationToken = default);
    Task<OAuthUserInfo?> GetGoogleUserInfoFromCredentialAsync(string credential, CancellationToken cancellationToken = default);
}

public record OAuthUserInfo(string Email, string FullName);
