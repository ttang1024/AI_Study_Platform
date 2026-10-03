using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Commands;

public record UpdateLibraryTagCommand(
    Guid UserId, Guid LibraryTagId, string Name, string? Color, string? Description)
    : IRequest<Result<LibraryTagDto>>;

public class UpdateLibraryTagCommandHandler
    : IRequestHandler<UpdateLibraryTagCommand, Result<LibraryTagDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateLibraryTagCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<LibraryTagDto>> Handle(
        UpdateLibraryTagCommand request, CancellationToken cancellationToken)
    {
        var tag = await _unitOfWork.LibraryTags.GetByIdAsync(request.LibraryTagId, cancellationToken);
        if (tag == null || tag.UserId != request.UserId)
            return Result<LibraryTagDto>.Failure("Not found.", "TAG_NOT_FOUND");

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
            return Result<LibraryTagDto>.Failure("Name is required.", "NAME_REQUIRED");

        // Only when the name actually changed, so saving a tag without renaming it cannot collide
        // with itself.
        if (!string.Equals(name, tag.Name, StringComparison.OrdinalIgnoreCase))
        {
            var clash = await _unitOfWork.LibraryTags.GetByNameAsync(request.UserId, name, tag.Kind, cancellationToken);
            if (clash != null)
                return Result<LibraryTagDto>.Failure("You already have one with that name.", "DUPLICATE_NAME");
        }

        tag.Name = name;
        tag.Color = request.Color;
        if (tag.Kind == LibraryTagKinds.Collection)
            tag.Description = request.Description;
        tag.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.LibraryTags.Update(tag);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var counts = await _unitOfWork.LibraryTags.GetForUserAsync(request.UserId, tag.Kind, cancellationToken);
        var count = counts.FirstOrDefault(c => c.Tag.LibraryTagId == tag.LibraryTagId)?.ItemCount ?? 0;

        return Result<LibraryTagDto>.Success(
            new LibraryTagDto(tag.LibraryTagId, tag.Name, tag.Kind, tag.Color, tag.Description, count, tag.CreatedAt),
            "Saved.");
    }
}
