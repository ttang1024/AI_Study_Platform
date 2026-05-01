using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

public record GetFeedbackStatsQuery : IRequest<Result<FeedbackStatsDto>>;

public class GetFeedbackStatsQueryHandler : IRequestHandler<GetFeedbackStatsQuery, Result<FeedbackStatsDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetFeedbackStatsQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<FeedbackStatsDto>> Handle(GetFeedbackStatsQuery request, CancellationToken cancellationToken)
    {
        var all = await _unitOfWork.Feedbacks.GetAllAsync(cancellationToken);
        var list = all.ToList();

        var byType = new Dictionary<string, int>
        {
            ["bug"] = list.Count(f => f.Type == "bug"),
            ["feature"] = list.Count(f => f.Type == "feature"),
            ["general"] = list.Count(f => f.Type == "general"),
        };

        var byStatus = new Dictionary<string, int>
        {
            ["new"] = list.Count(f => f.Status == "new"),
            ["read"] = list.Count(f => f.Status == "read"),
            ["in_progress"] = list.Count(f => f.Status == "in_progress"),
            ["resolved"] = list.Count(f => f.Status == "resolved"),
            ["archived"] = list.Count(f => f.Status == "archived"),
        };

        var rated = list.Where(f => f.Rating.HasValue).ToList();
        double? avgRating = rated.Count > 0 ? rated.Average(f => f.Rating!.Value) : null;

        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var recentCount = list.Count(f => f.SubmittedAt >= sevenDaysAgo);

        var dto = new FeedbackStatsDto(list.Count, byType, byStatus, avgRating, recentCount);
        return Result<FeedbackStatsDto>.Success(dto);
    }
}
