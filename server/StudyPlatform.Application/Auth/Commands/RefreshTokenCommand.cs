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

    public RefreshTokenCommandHandler(IUnitOfWork unitOfWork, ITokenService tokenService)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
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
        _unitOfWork.RefreshTokens.Update(token);

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var newRefreshToken = new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            Token = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };

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
