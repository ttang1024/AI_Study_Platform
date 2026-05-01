using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record SetUserActiveStatusCommand(Guid UserId, bool IsActive) : IRequest<Result<UserDto>>;

public class SetUserActiveStatusCommandHandler : IRequestHandler<SetUserActiveStatusCommand, Result<UserDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SetUserActiveStatusCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<UserDto>> Handle(SetUserActiveStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<UserDto>.Failure("User not found.", "NOT_FOUND");

        if (user.IsAdmin)
            return Result<UserDto>.Failure("Cannot change status of an admin account.", "FORBIDDEN");

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new UserDto(user.UserId, user.Email, user.FullName,
            user.IsEmailVerified, user.IsAdmin, user.IsActive, user.CreatedAt);

        return Result<UserDto>.Success(dto);
    }
}
