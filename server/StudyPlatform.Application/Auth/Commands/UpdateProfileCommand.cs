using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record UpdateProfileCommand(
    Guid UserId,
    string FullName) : IRequest<Result>;

public class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateProfileCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result.Failure("User not found.", "USER_NOT_FOUND");

        user.FullName = request.FullName;
        user.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Profile updated successfully.");
    }
}
