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
}
