using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record UpdateFeedbackStatusCommand(Guid Id, string Status) : IRequest<Result<FeedbackItemDto>>;

public class UpdateFeedbackStatusCommandHandler : IRequestHandler<UpdateFeedbackStatusCommand, Result<FeedbackItemDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFeedbackRepository _feedbacks;

    public UpdateFeedbackStatusCommandHandler(IUnitOfWork unitOfWork, IFeedbackRepository feedbacks)
    {
        _unitOfWork = unitOfWork;
        _feedbacks = feedbacks;
    }

    public async Task<Result<FeedbackItemDto>> Handle(UpdateFeedbackStatusCommand request, CancellationToken cancellationToken)
    {
        var feedback = await _feedbacks.GetByIdAsync(request.Id, cancellationToken);
        if (feedback == null)
            return Result<FeedbackItemDto>.Failure("Feedback not found.", "NOT_FOUND");

        feedback.Status = request.Status;
        if (request.Status == "resolved")
            feedback.ResolvedAt = DateTime.UtcNow;

        _feedbacks.Update(feedback);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FeedbackItemDto>.Success(feedback.ToDto());
    }
}
