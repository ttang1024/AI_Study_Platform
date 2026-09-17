using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

/// <summary>Page-view analytics for the admin dashboard over a trailing window of days.</summary>
public record GetPageVisitAnalyticsQuery(int Days = 30) : IRequest<Result<PageVisitAnalytics>>;

public class GetPageVisitAnalyticsQueryHandler : IRequestHandler<GetPageVisitAnalyticsQuery, Result<PageVisitAnalytics>>
{
    private readonly IAdminAnalyticsRepository _analytics;

    public GetPageVisitAnalyticsQueryHandler(IAdminAnalyticsRepository analytics) => _analytics = analytics;

    public async Task<Result<PageVisitAnalytics>> Handle(GetPageVisitAnalyticsQuery request, CancellationToken cancellationToken)
    {
        // Clamped again in the repository; doing it here keeps a silly ?days= out of the query plan.
        var data = await _analytics.GetPageVisitAnalyticsAsync(request.Days, cancellationToken);
        return Result<PageVisitAnalytics>.Success(data);
    }
}
