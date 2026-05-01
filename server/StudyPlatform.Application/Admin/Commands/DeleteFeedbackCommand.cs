using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record DeleteFeedbackCommand(Guid Id) : IRequest<Result>;

public class DeleteFeedbackCommandHandler : IRequestHandler<DeleteFeedbackCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteFeedbackCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(DeleteFeedbackCommand request, CancellationToken cancellationToken)
    {
        var feedback = await _unitOfWork.Feedbacks.GetByIdAsync(request.Id, cancellationToken);
        if (feedback == null)
            return Result.Failure("Feedback not found.", "NOT_FOUND");

        _unitOfWork.Feedbacks.Remove(feedback);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Deleted.");
    }
}
