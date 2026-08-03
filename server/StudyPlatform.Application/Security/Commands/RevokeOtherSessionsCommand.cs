using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// "Sign out everywhere else" — revokes every session but the caller's own.
///
/// <para>Keeping the current one is the point: a user who suspects a compromise needs to cut the
/// other sessions without also locking themselves out mid-remediation.</para>
/// </summary>
public record RevokeOtherSessionsCommand(Guid UserId, string? CurrentToken) : IRequest<Result<int>>;

public class RevokeOtherSessionsCommandHandler : IRequestHandler<RevokeOtherSessionsCommand, Result<int>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogger _audit;

    public RevokeOtherSessionsCommandHandler(IUnitOfWork unitOfWork, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<Result<int>> Handle(RevokeOtherSessionsCommand request, CancellationToken cancellationToken)
    {
        var count = await _unitOfWork.RefreshTokens.RevokeOtherSessionsAsync(
            request.UserId, request.CurrentToken, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(AuditActions.LogoutAll, request.UserId,
            metadata: new { revoked = count }, cancellationToken: cancellationToken);

        return Result<int>.Success(count,
            count == 1 ? "1 other session signed out." : $"{count} other sessions signed out.");
    }
}
