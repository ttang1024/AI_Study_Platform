using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record LogoutCommand(string RefreshToken) : IRequest<Result>;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand, Result>
{
    private readonly IRefreshTokenRepository _refreshTokens;

    public LogoutCommandHandler(IRefreshTokenRepository refreshTokens)
    {
        _refreshTokens = refreshTokens;
    }

    public async Task<Result> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(request.RefreshToken))
            return Result.Success("Logged out successfully.");

        // Ends the sign-in, not just the current rotation: older rotations of it are already revoked,
        // but this also covers a token that was rotated by a refresh still in flight.
        var token = await _refreshTokens.FindByHashAsync(RefreshTokenHash.Compute(request.RefreshToken), cancellationToken);
        if (token != null)
            await _refreshTokens.RevokeSessionAsync(token.UserId, token.SessionId, cancellationToken);

        return Result.Success("Logged out successfully.");
    }
}
