using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Turns "this user is who they claim to be" into a session.
///
/// <para>Every sign-in path — password, registration, OAuth, Google credential, and refresh —
/// ends the same way: mint an access token, persist a refresh-token row, and hand back the
/// envelope the clients store. Keeping that one step in one place is what stops the five paths
/// drifting apart on session identity or token lifetime.</para>
/// </summary>
public interface IAuthSessionIssuer
{
    /// <param name="rotating">
    /// The refresh token being rotated, when this is a refresh rather than a fresh sign-in. The new
    /// row inherits its session id and device annotation so rotation does not present the user with
    /// a brand-new "device" in their session list every fifteen minutes.
    /// </param>
    Task<AuthResponse> IssueAsync(
        User user, RefreshToken? rotating = null, CancellationToken cancellationToken = default);
}
