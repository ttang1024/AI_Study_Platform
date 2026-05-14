# Auth

## Backend

`AuthController` is mounted at `/api/auth`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/send-otp` | Send email OTP for registration or password reset |
| `POST` | `/api/auth/register` | Create user after OTP validation |
| `POST` | `/api/auth/login` | Email/password login |
| `POST` | `/api/auth/refresh-token` | Rotate access token using refresh token |
| `POST` | `/api/auth/reset-password` | Reset password after OTP validation |
| `POST` | `/api/auth/change-password` | Authenticated password change |
| `PUT` | `/api/auth/update-profile` | Authenticated profile update |
| `POST` | `/api/auth/oauth` | OAuth login flow |
| `POST` | `/api/auth/google-credential` | Google Identity Services credential login |
| `POST` | `/api/auth/logout` | Revoke refresh token/session |

Application handlers live under `StudyPlatform.Application/Auth`. Infrastructure services are `TokenService`, `PasswordHasher`, `OAuthService`, `EmailService`, and `OtpRepository`.

## Login Flow

`LoginCommandHandler` looks up the user by email, verifies the bcrypt hash, checks email-verification and active-account status, then issues a 15-minute JWT access token and a 7-day refresh token.

```csharp
// LoginCommand.cs — LoginCommandHandler
public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
{
    var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
    if (user == null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");

    if (!user.IsEmailVerified)
        return Result<AuthResponse>.Failure("Email not verified.", "EMAIL_NOT_VERIFIED");

    if (!user.IsActive)
        return Result<AuthResponse>.Failure("Your account has been deactivated.", "ACCOUNT_DEACTIVATED");

    var accessToken      = _tokenService.GenerateAccessToken(user);
    var refreshTokenValue = _tokenService.GenerateRefreshToken();
    var refreshToken = new RefreshToken
    {
        TokenId   = Guid.NewGuid(),
        UserId    = user.UserId,
        Token     = refreshTokenValue,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        IsRevoked = false,
        CreatedAt = DateTime.UtcNow
    };

    await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
    await _unitOfWork.SaveChangesAsync(cancellationToken);

    return Result<AuthResponse>.Success(
        new AuthResponse(user.UserId, user.Email, user.FullName,
                         accessToken, refreshTokenValue,
                         DateTime.UtcNow.AddMinutes(15)));
}
```

## Token Refresh

`RefreshTokenCommandHandler` revokes the used refresh token and issues a fresh pair, preventing token replay.

```csharp
// RefreshTokenCommand.cs — RefreshTokenCommandHandler
public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
{
    var token = await _unitOfWork.RefreshTokens.GetValidTokenAsync(request.RefreshToken, cancellationToken);
    if (token == null)
        return Result<AuthResponse>.Failure("Invalid or expired refresh token.", "INVALID_REFRESH_TOKEN");

    var user = await _unitOfWork.Users.GetByIdAsync(token.UserId, cancellationToken);
    if (user == null)
        return Result<AuthResponse>.Failure("User not found.", "USER_NOT_FOUND");

    token.IsRevoked = true;   // revoke old token immediately
    _unitOfWork.RefreshTokens.Update(token);

    // Issue fresh pair
    var accessToken       = _tokenService.GenerateAccessToken(user);
    var refreshTokenValue = _tokenService.GenerateRefreshToken();
    await _unitOfWork.RefreshTokens.AddAsync(new RefreshToken
    {
        TokenId   = Guid.NewGuid(), UserId = user.UserId,
        Token     = refreshTokenValue,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        IsRevoked = false, CreatedAt = DateTime.UtcNow
    }, cancellationToken);

    await _unitOfWork.SaveChangesAsync(cancellationToken);
    return Result<AuthResponse>.Success(
        new AuthResponse(user.UserId, user.Email, user.FullName,
                         accessToken, refreshTokenValue,
                         DateTime.UtcNow.AddMinutes(15)));
}
```

## Token Model

The API uses JWT bearer tokens for request auth. `Program.cs` validates issuer, audience, signing key, lifetime, and sets `Token-Expired: true` on expired-token failures. Refresh tokens are persisted through `RefreshToken`.

## OAuth

OAuth support is implemented server-side in `OAuthService`; client routes include `/auth/callback`. Google One Tap / Identity Services uses the dedicated `/api/auth/google-credential` endpoint. See `tech/google-identity-services.md`.
