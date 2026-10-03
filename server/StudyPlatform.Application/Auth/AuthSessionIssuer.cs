using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth;

/// <inheritdoc cref="IAuthSessionIssuer"/>
public class AuthSessionIssuer : IAuthSessionIssuer
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IRequestContext _requestContext;

    public AuthSessionIssuer(
        IUnitOfWork unitOfWork, ITokenService tokenService, IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _requestContext = requestContext;
    }

    public async Task<AuthResponse> IssueAsync(
        User user, RefreshToken? rotating = null, CancellationToken cancellationToken = default)
    {
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

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
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
