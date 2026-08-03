using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<AuthResponse>>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IRequestContext _requestContext;

    public RefreshTokenCommandHandler(
        IUnitOfWork unitOfWork, ITokenService tokenService, IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _requestContext = requestContext;
    }

    public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var token = await _unitOfWork.RefreshTokens.GetValidTokenAsync(request.RefreshToken, cancellationToken);
        if (token == null)
            return Result<AuthResponse>.Failure("Invalid or expired refresh token.", "INVALID_REFRESH_TOKEN");

        var user = await _unitOfWork.Users.GetByIdAsync(token.UserId, cancellationToken);
        if (user == null)
            return Result<AuthResponse>.Failure("User not found.", "USER_NOT_FOUND");

        token.IsRevoked = true;
        token.RevokedAt = DateTime.UtcNow;
        _unitOfWork.RefreshTokens.Update(token);

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();

        // Inherits the session id, so rotation keeps the sign-in's identity rather than presenting
        // the user with a brand-new "device" in their session list every fifteen minutes.
        var newRefreshToken = RefreshTokenFactory.Create(
            user.UserId, refreshTokenValue, _requestContext, token.SessionId);

        // The device fields are carried over rather than re-derived when the refresh arrives without
        // a recognisable user agent, so a session keeps the name it was signed in under.
        newRefreshToken.DeviceName ??= token.DeviceName;
        newRefreshToken.UserAgent ??= token.UserAgent;
        newRefreshToken.IpAddress ??= token.IpAddress;

        await _unitOfWork.RefreshTokens.AddAsync(newRefreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var response = new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15));

        return Result<AuthResponse>.Success(response, "Token refreshed successfully.");
    }
}
