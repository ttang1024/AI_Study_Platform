namespace StudyPlatform.Application.Auth;

/// <summary>
/// How long the two tokens a sign-in hands out stay valid.
///
/// <para>Single-sourced here because the access-token lifetime has to agree in two places that
/// never see each other: the JWT's own <c>exp</c> claim (minted in Infrastructure) and the
/// <c>accessTokenExpiry</c> the client schedules its silent refresh against.</para>
/// </summary>
public static class AuthTokenLifetimes
{
    public static readonly TimeSpan AccessToken = TimeSpan.FromMinutes(15);

    public static readonly TimeSpan RefreshToken = TimeSpan.FromDays(7);

    /// <summary>
    /// How long after rotation a refresh token may be presented again without being treated as stolen.
    /// Two tabs sharing the refresh cookie can both refresh in the same instant; the slower one carries
    /// the token the faster one just rotated. Past this window, a rotated token coming back means a copy
    /// of it exists somewhere it should not, and the whole session is revoked.
    /// </summary>
    public static readonly TimeSpan RotationReuseGrace = TimeSpan.FromSeconds(30);
}
