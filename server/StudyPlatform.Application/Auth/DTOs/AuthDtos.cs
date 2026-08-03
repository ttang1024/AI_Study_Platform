namespace StudyPlatform.Application.Auth.DTOs;

public record SendEmailOtpRequest(string Email, string Purpose);

public record RegisterRequest(
    string Email,
    string Password,
    string FullName,
    string OtpCode);

public record LoginRequest(string Email, string Password);

public record RefreshTokenRequest(string? RefreshToken = null);

public record ResetPasswordRequest(
    string Email,
    string OtpCode,
    string NewPassword);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public record UpdateProfileRequest(string FullName);

/// <summary>
/// The result of any sign-in attempt.
///
/// <para>Also carries the "not finished yet" case. When <see cref="TwoFactorRequired"/> is true the
/// password leg passed but no session exists: the token fields are empty and
/// <see cref="ChallengeToken"/> is what the second leg is redeemed with. Modelled as one response
/// rather than two so every existing caller keeps compiling and clients that predate 2FA simply see
/// a flag they ignore — but a client that ignores it will find the tokens blank, which fails loudly
/// rather than silently letting someone past the factor.</para>
/// </summary>
public record AuthResponse(
    Guid UserId,
    string Email,
    string FullName,
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiry,
    bool TwoFactorRequired = false,
    string? ChallengeToken = null);

public record OAuthLoginRequest(string Provider, string Code, string RedirectUri);

public record GoogleCredentialLoginRequest(string Credential);

public record UserDto(
    Guid UserId,
    string Email,
    string FullName,
    bool IsEmailVerified,
    DateTime CreatedAt);
