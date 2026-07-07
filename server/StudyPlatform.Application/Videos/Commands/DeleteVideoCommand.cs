using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record DeleteVideoCommand(Guid Id, Guid UserId) : IRequest<Result>;

public class DeleteVideoCommandHandler : IRequestHandler<DeleteVideoCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteVideoCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(DeleteVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);
        if (video is null)
            return Result.Failure("Video not found.", "NOT_FOUND");

        _unitOfWork.Videos.Remove(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
