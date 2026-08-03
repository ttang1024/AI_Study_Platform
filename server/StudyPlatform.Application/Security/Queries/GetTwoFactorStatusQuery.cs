using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Queries;

public record GetTwoFactorStatusQuery(Guid UserId) : IRequest<Result<TwoFactorStatusDto>>;

public class GetTwoFactorStatusQueryHandler
    : IRequestHandler<GetTwoFactorStatusQuery, Result<TwoFactorStatusDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetTwoFactorStatusQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<TwoFactorStatusDto>> Handle(
        GetTwoFactorStatusQuery request, CancellationToken cancellationToken)
    {
        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(request.UserId, cancellationToken);

        // A pending enrolment reads as "off" here, because that is what it means for login. Only
        // IsEnabled gates anything, so surfacing the half-finished row would just be confusing.
        if (factor is not { IsEnabled: true })
            return Result<TwoFactorStatusDto>.Success(new TwoFactorStatusDto(false, null, 0));

        return Result<TwoFactorStatusDto>.Success(new TwoFactorStatusDto(
            true,
            factor.EnabledAt,
            TwoFactorCodes.ReadHashes(factor.RecoveryCodeHashesJson).Count));
    }
}
