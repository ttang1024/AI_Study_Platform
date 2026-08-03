using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.LibraryTags.Queries;

/// <param name="Kind">Null returns both tags and collections; otherwise one kind.</param>
public record GetLibraryTagsQuery(Guid UserId, string? Kind)
    : IRequest<Result<IReadOnlyList<LibraryTagDto>>>;

public class GetLibraryTagsQueryHandler
    : IRequestHandler<GetLibraryTagsQuery, Result<IReadOnlyList<LibraryTagDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetLibraryTagsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<LibraryTagDto>>> Handle(
        GetLibraryTagsQuery request, CancellationToken cancellationToken)
    {
        var kind = string.IsNullOrWhiteSpace(request.Kind) ? null : request.Kind.Trim().ToLowerInvariant();

        var tags = await _unitOfWork.LibraryTags.GetForUserAsync(request.UserId, kind, cancellationToken);

        IReadOnlyList<LibraryTagDto> dtos = tags
            .Select(t => new LibraryTagDto(
                t.Tag.LibraryTagId,
                t.Tag.Name,
                t.Tag.Kind,
                t.Tag.Color,
                t.Tag.Description,
                t.ItemCount,
                t.Tag.CreatedAt))
            .ToList();

        return Result<IReadOnlyList<LibraryTagDto>>.Success(dtos);
    }
}
