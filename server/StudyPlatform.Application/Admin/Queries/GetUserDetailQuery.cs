using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

/// <summary>Per-user activity rollup for the admin user-detail drill-down.</summary>
public record GetUserDetailQuery(Guid UserId) : IRequest<Result<UserActivityDetail>>;

public class GetUserDetailQueryHandler : IRequestHandler<GetUserDetailQuery, Result<UserActivityDetail>>
{
    private readonly IAdminAnalyticsRepository _analytics;

    public GetUserDetailQueryHandler(IAdminAnalyticsRepository analytics) => _analytics = analytics;

    public async Task<Result<UserActivityDetail>> Handle(GetUserDetailQuery request, CancellationToken cancellationToken)
    {
        var detail = await _analytics.GetUserDetailAsync(request.UserId, cancellationToken);
        return detail is null
            ? Result<UserActivityDetail>.Failure("User not found.", "NOT_FOUND")
            : Result<UserActivityDetail>.Success(detail);
    }
}
