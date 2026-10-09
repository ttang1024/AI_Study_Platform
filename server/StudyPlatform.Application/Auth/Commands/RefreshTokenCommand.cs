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
        var token = string.IsNullOrEmpty(request.RefreshToken)
            ? null
            : await _unitOfWork.RefreshTokens.FindByHashAsync(RefreshTokenHash.Compute(request.RefreshToken), cancellationToken);
        if (token == null || token.ExpiresAt <= DateTime.UtcNow)
            return Invalid();

        if (token.IsRevoked)
        {
            // A rotated token presented again after the grace window: someone holds a copy. Ending the
            // whole sign-in locks out both the thief and the victim, and the victim can sign back in.
            if (token.RevokedAt is { } revokedAt && DateTime.UtcNow - revokedAt > AuthTokenLifetimes.RotationReuseGrace)
                await _unitOfWork.RefreshTokens.RevokeSessionAsync(token.UserId, token.SessionId, cancellationToken);
            return Invalid();
        }

        var user = await _unitOfWork.Users.GetByIdAsync(token.UserId, cancellationToken);
        if (user == null)
            return Result<AuthResponse>.Failure("User not found.", "USER_NOT_FOUND");

        // A deactivated account (or one pending deletion) gets no new access tokens, whatever
        // refresh token it still holds.
        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        // Claimed atomically: of two concurrent refreshes with this token, only one gets past here.
        if (!await _unitOfWork.RefreshTokens.TryRevokeAsync(token.TokenId, cancellationToken))
            return Invalid();

        var response = await _sessionIssuer.IssueAsync(user, token, cancellationToken);
        return Result<AuthResponse>.Success(response, "Token refreshed successfully.");
    }

    private static Result<AuthResponse> Invalid()
        => Result<AuthResponse>.Failure("Invalid or expired refresh token.", "INVALID_REFRESH_TOKEN");
}
