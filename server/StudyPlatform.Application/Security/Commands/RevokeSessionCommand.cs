using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Signs one device out, revoking every token in that session. The user id is part of the lookup
/// rather than a check after it, so a guessed session id belonging to someone else finds nothing.
/// </summary>
public record RevokeSessionCommand(Guid UserId, Guid SessionId) : IRequest<Result>;

public class RevokeSessionCommandHandler : IRequestHandler<RevokeSessionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public RevokeSessionCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result> Handle(RevokeSessionCommand request, CancellationToken cancellationToken)
    {
        var revoked = await _unitOfWork.RefreshTokens.RevokeSessionAsync(
            request.UserId, request.SessionId, cancellationToken);

        if (!revoked)
            return Result.Failure("Session not found.", "SESSION_NOT_FOUND");

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(AuditActions.SessionRevoked, request.UserId,
            targetType: "Session", targetId: request.SessionId.ToString(),
            cancellationToken: cancellationToken);

        return Result.Success("Session signed out.");
    }
}
