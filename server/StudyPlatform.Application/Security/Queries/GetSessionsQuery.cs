using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Queries;

/// <summary>
/// The user's live sessions. <paramref name="CurrentToken"/> is the caller's own refresh token, used
/// only to flag which row is "this device" — so the UI can warn before someone signs themselves out.
/// </summary>
public record GetSessionsQuery(Guid UserId, string? CurrentToken)
    : IRequest<Result<IReadOnlyList<SessionDto>>>;

public class GetSessionsQueryHandler : IRequestHandler<GetSessionsQuery, Result<IReadOnlyList<SessionDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetSessionsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<SessionDto>>> Handle(
        GetSessionsQuery request, CancellationToken cancellationToken)
    {
        var sessions = await _unitOfWork.RefreshTokens.GetActiveSessionsAsync(
            request.UserId, request.CurrentToken, cancellationToken);

        var dtos = sessions
            .Select(s => new SessionDto(
                s.SessionId,
                s.DeviceName,
                s.IpAddress,
                s.StartedAt,
                s.LastUsedAt,
                s.ExpiresAt,
                s.IsCurrent))
            .ToList();

        return Result<IReadOnlyList<SessionDto>>.Success(dtos);
    }
}
