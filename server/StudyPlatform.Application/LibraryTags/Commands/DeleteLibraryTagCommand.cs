using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Commands;

/// <summary>
/// Deletes a tag or collection. Its assignments go with it via cascade — the items themselves are
/// untouched, which is the difference between deleting a folder here and deleting one on a disk.
/// </summary>
public record DeleteLibraryTagCommand(Guid UserId, Guid LibraryTagId) : IRequest<Result>;

public class DeleteLibraryTagCommandHandler : IRequestHandler<DeleteLibraryTagCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteLibraryTagCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(DeleteLibraryTagCommand request, CancellationToken cancellationToken)
    {
        var tag = await _unitOfWork.LibraryTags.GetByIdAsync(request.LibraryTagId, cancellationToken);
        if (tag == null || tag.UserId != request.UserId)
            return Result.Failure("Not found.", "TAG_NOT_FOUND");

        _unitOfWork.LibraryTags.Remove(tag);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Deleted. Your items were not removed.");
    }
}
