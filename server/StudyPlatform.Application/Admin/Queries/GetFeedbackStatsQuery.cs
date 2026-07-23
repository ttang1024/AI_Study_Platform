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
        var stats = await _unitOfWork.Feedbacks.GetStatsAsync(DateTime.UtcNow.AddDays(-7), cancellationToken);

        var dto = new FeedbackStatsDto(
            stats.Total,
            new Dictionary<string, int>(stats.ByType),
            new Dictionary<string, int>(stats.ByStatus),
            stats.AverageRating,
            stats.RecentCount);
        return Result<FeedbackStatsDto>.Success(dto);
    }
}
