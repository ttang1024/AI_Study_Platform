using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

/// <summary>Platform-wide analytics for the admin dashboard (user growth, engagement, content, top users).</summary>
public record GetPlatformAnalyticsQuery : IRequest<Result<PlatformAnalytics>>;

public class GetPlatformAnalyticsQueryHandler : IRequestHandler<GetPlatformAnalyticsQuery, Result<PlatformAnalytics>>
{
    private readonly IAdminAnalyticsRepository _analytics;

    public GetPlatformAnalyticsQueryHandler(IAdminAnalyticsRepository analytics) => _analytics = analytics;

    public async Task<Result<PlatformAnalytics>> Handle(GetPlatformAnalyticsQuery request, CancellationToken cancellationToken)
    {
        var data = await _analytics.GetPlatformAnalyticsAsync(cancellationToken);
        return Result<PlatformAnalytics>.Success(data);
    }
}
