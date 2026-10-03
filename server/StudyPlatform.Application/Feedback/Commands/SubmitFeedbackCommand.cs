using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Feedback.Commands;

public record SubmitFeedbackCommand(
    string Type,
    string Subject,
    string Message,
    int? Rating,
    Guid? UserId,
    string? UserEmail) : IRequest<Result>;

public class SubmitFeedbackCommandHandler : IRequestHandler<SubmitFeedbackCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public SubmitFeedbackCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result> Handle(SubmitFeedbackCommand request, CancellationToken cancellationToken)
    {
        var feedback = new Domain.Entities.Feedback
        {
            Id = Guid.NewGuid(),
            Type = request.Type,
            Status = "new",
            Subject = request.Subject,
            Message = request.Message,
            Rating = request.Rating,
            SubmittedAt = DateTime.UtcNow,
            UserId = request.UserId,
            UserEmail = request.UserEmail,
        };

        await _unitOfWork.Feedbacks.AddAsync(feedback, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Feedback submitted. Thank you!");
    }
}
