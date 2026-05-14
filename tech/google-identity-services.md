# Google Identity Services

## Current Integration

The web app uses Google Identity Services for credential login and sends the credential to:

`POST /api/auth/google-credential`

The backend handler validates the Google credential, maps the profile to a platform user, and returns the same auth response shape used by normal login.

## Related Files

| Path | Role |
| --- | --- |
| `web/src/pages/LoginPage.tsx` | Login UI and Google entry point |
| `web/src/pages/RegisterPage.tsx` | Registration UI |
| `web/src/pages/OAuthCallbackPage.tsx` | OAuth callback handling |
| `web/src/services/authService.ts` | Auth API client |
| `server/StudyPlatform.API/Controllers/AuthController.cs` | `/api/auth/google-credential` |
| `server/StudyPlatform.Application/Auth/Commands/OAuthLoginCommand.cs` | OAuth/GIS command logic |
| `server/StudyPlatform.Infrastructure/Services/OAuthService.cs` | Provider calls |

## Backend Handler

Both `OAuthLoginCommandHandler` (server-side OAuth code exchange) and `GoogleCredentialLoginCommandHandler` (Google One Tap credential) share the same upsert pattern: look up the user by email; create a new account if not found; reject deactivated accounts; then issue a fresh token pair.

```csharp
// OAuthLoginCommand.cs — GoogleCredentialLoginCommandHandler
public async Task<Result<AuthResponse>> Handle(
    GoogleCredentialLoginCommand request, CancellationToken ct)
{
    // Validate the Google credential (JWT) and extract profile info
    var userInfo = await _oAuthService.GetGoogleUserInfoFromCredentialAsync(request.Credential, ct);
    if (userInfo == null)
        return Result<AuthResponse>.Failure(
            "Failed to authenticate with Google.", "GOOGLE_CREDENTIAL_FAILED");

    // Upsert: find by email or create a pre-verified account
    var user = await _unitOfWork.Users
        .GetByEmailAsync(userInfo.Email.ToLowerInvariant(), ct);

    if (user == null)
    {
        user = new User
        {
            UserId          = Guid.NewGuid(),
            Email           = userInfo.Email.ToLowerInvariant(),
            PasswordHash    = string.Empty,   // no password for OAuth accounts
            FullName        = userInfo.FullName,
            IsEmailVerified = true,           // Google already verified the email
            IsActive        = true,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow
        };
        await _unitOfWork.Users.AddAsync(user, ct);
    }

    if (!user.IsActive)
        return Result<AuthResponse>.Failure("Account deactivated.", "ACCOUNT_DEACTIVATED");

    var accessToken       = _tokenService.GenerateAccessToken(user);
    var refreshTokenValue = _tokenService.GenerateRefreshToken();
    await _unitOfWork.RefreshTokens.AddAsync(new RefreshToken
    {
        TokenId   = Guid.NewGuid(), UserId = user.UserId,
        Token     = refreshTokenValue,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        IsRevoked = false, CreatedAt = DateTime.UtcNow
    }, ct);

    await _unitOfWork.SaveChangesAsync(ct);
    return Result<AuthResponse>.Success(new AuthResponse(
        user.UserId, user.Email, user.FullName,
        accessToken, refreshTokenValue, DateTime.UtcNow.AddMinutes(15)));
}
```

The standard OAuth code flow (`OAuthLoginCommandHandler`) uses `IOAuthService.GetUserInfoAsync(provider, code, redirectUri)` instead of the credential path, but the upsert and token-issue logic is identical.

## Configuration

| Client key | Server key |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | `GoogleOAuth:ClientId` |
| none | `GoogleOAuth:ClientSecret` for server OAuth flow |
