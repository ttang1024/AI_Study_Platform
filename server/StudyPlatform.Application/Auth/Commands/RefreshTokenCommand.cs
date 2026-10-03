using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<AuthResponse>>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuthSessionIssuer _sessionIssuer;

    public RefreshTokenCommandHandler(IUnitOfWork unitOfWork, IAuthSessionIssuer sessionIssuer)
    {
        _unitOfWork = unitOfWork;
        _sessionIssuer = sessionIssuer;
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

        var response = await _sessionIssuer.IssueAsync(user, token, cancellationToken);
        return Result<AuthResponse>.Success(response, "Token refreshed successfully.");
    }
}
