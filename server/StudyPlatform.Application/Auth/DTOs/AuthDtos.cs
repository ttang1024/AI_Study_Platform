namespace StudyPlatform.Application.Auth.DTOs;

public record SendEmailOtpRequest(string Email, string Purpose);

public record RegisterRequest(
    string Email,
    string Password,
    string FullName,
    string OtpCode);

public record LoginRequest(string Email, string Password);

public record RefreshTokenRequest(string RefreshToken);

public record ResetPasswordRequest(
    string Email,
    string OtpCode,
    string NewPassword);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public record UpdateProfileRequest(string FullName);

public record AuthResponse(
    Guid UserId,
    string Email,
    string FullName,
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiry);

public record OAuthLoginRequest(string Provider, string Code, string RedirectUri);

public record UserDto(
    Guid UserId,
    string Email,
    string FullName,
    bool IsEmailVerified,
    DateTime CreatedAt);
