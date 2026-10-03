using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Completes a sign-in that an external identity provider has already vouched for: finds or
/// provisions the local account for the verified email, then issues its session.
///
/// <para>Shared by every provider handler, so which provider vouched is the only thing those
/// handlers differ on.</para>
/// </summary>
public interface IExternalSignIn
{
    Task<Result<AuthResponse>> CompleteAsync(OAuthUserInfo userInfo, CancellationToken cancellationToken = default);
}
