using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Queries;

public record GetFeedbackByIdQuery(Guid Id) : IRequest<Result<FeedbackItemDto>>;

public class GetFeedbackByIdQueryHandler : IRequestHandler<GetFeedbackByIdQuery, Result<FeedbackItemDto>>
{
    private readonly IFeedbackRepository _feedbacks;

    public GetFeedbackByIdQueryHandler(IFeedbackRepository feedbacks) => _feedbacks = feedbacks;

    public async Task<Result<FeedbackItemDto>> Handle(GetFeedbackByIdQuery request, CancellationToken cancellationToken)
    {
        var feedback = await _feedbacks.GetByIdAsync(request.Id, cancellationToken);
        if (feedback == null)
            return Result<FeedbackItemDto>.Failure("Feedback not found.", "NOT_FOUND");

        return Result<FeedbackItemDto>.Success(feedback.ToDto());
    }
}
