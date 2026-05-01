using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record SaveAdminNoteCommand(Guid Id, string AdminNote) : IRequest<Result<FeedbackItemDto>>;

public class SaveAdminNoteCommandHandler : IRequestHandler<SaveAdminNoteCommand, Result<FeedbackItemDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SaveAdminNoteCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<FeedbackItemDto>> Handle(SaveAdminNoteCommand request, CancellationToken cancellationToken)
    {
        var feedback = await _unitOfWork.Feedbacks.GetByIdAsync(request.Id, cancellationToken);
        if (feedback == null)
            return Result<FeedbackItemDto>.Failure("Feedback not found.", "NOT_FOUND");

        feedback.AdminNote = request.AdminNote;
        _unitOfWork.Feedbacks.Update(feedback);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FeedbackItemDto>.Success(feedback.ToDto());
    }
}
