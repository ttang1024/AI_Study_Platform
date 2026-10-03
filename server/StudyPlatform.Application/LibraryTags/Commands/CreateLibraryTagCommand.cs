using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Commands;

public record CreateLibraryTagCommand(
    Guid UserId, string Name, string Kind, string? Color, string? Description)
    : IRequest<Result<LibraryTagDto>>;

public class CreateLibraryTagCommandHandler
    : IRequestHandler<CreateLibraryTagCommand, Result<LibraryTagDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateLibraryTagCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<LibraryTagDto>> Handle(
        CreateLibraryTagCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length == 0)
            return Result<LibraryTagDto>.Failure("Name is required.", "NAME_REQUIRED");

        var kind = request.Kind?.Trim().ToLowerInvariant() ?? LibraryTagKinds.Tag;
        if (!LibraryTagKinds.IsValid(kind))
            return Result<LibraryTagDto>.Failure("Kind must be 'tag' or 'collection'.", "INVALID_KIND");

        var existing = await _unitOfWork.LibraryTags.GetByNameAsync(request.UserId, name, kind, cancellationToken);
        if (existing != null)
            return Result<LibraryTagDto>.Failure(
                kind == LibraryTagKinds.Collection
                    ? "You already have a collection with that name."
                    : "You already have a tag with that name.",
                "DUPLICATE_NAME");

        var now = DateTime.UtcNow;
        var tag = new LibraryTag
        {
            LibraryTagId = Guid.NewGuid(),
            UserId = request.UserId,
            Name = name,
            Kind = kind,
            Color = request.Color,
            // Descriptions belong to collections; a tag is a label, and storing one would surface an
            // empty field in the tag editor for no reason.
            Description = kind == LibraryTagKinds.Collection ? request.Description : null,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _unitOfWork.LibraryTags.AddAsync(tag, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<LibraryTagDto>.Success(
            new LibraryTagDto(tag.LibraryTagId, tag.Name, tag.Kind, tag.Color, tag.Description, 0, tag.CreatedAt),
            kind == LibraryTagKinds.Collection ? "Collection created." : "Tag created.");
    }
}
