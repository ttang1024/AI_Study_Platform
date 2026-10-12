using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth;

/// <inheritdoc cref="IAuthSessionIssuer"/>
public class AuthSessionIssuer : IAuthSessionIssuer
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IUserRepository _users;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly ITokenService _tokenService;
    private readonly IRequestContext _requestContext;

    public AuthSessionIssuer(
        IUnitOfWork unitOfWork, IUserRepository users, IRefreshTokenRepository refreshTokens, ITokenService tokenService, IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _users = users;
        _refreshTokens = refreshTokens;
        _tokenService = tokenService;
        _requestContext = requestContext;
    }

    public async Task<AuthResponse> IssueAsync(
        User user, RefreshToken? rotating = null, CancellationToken cancellationToken = default)
    {
        // Every sign-in and refresh records the device's zone, so reminders and other work with no
        // request of its own know where the user's day starts. Refreshes run every 15 minutes, which
        // keeps it current for a user who travels.
        if (_requestContext.TimeZone is { } zone && zone != user.TimeZone)
        {
            user.TimeZone = zone;
            _users.Update(user);
        }

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(
            user.UserId, refreshTokenValue, _requestContext, rotating?.SessionId);

        if (rotating != null)
        {
            // Carried over rather than re-derived, so a session keeps the name it was signed in
            // under even when the refresh arrives without a recognisable user agent.
            refreshToken.DeviceName ??= rotating.DeviceName;
            refreshToken.UserAgent ??= rotating.UserAgent;
            refreshToken.IpAddress ??= rotating.IpAddress;
        }

        await _refreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.Add(AuthTokenLifetimes.AccessToken));
    }
}
