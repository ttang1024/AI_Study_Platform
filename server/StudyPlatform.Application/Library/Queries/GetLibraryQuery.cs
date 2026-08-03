using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Library.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Library.Queries;

/// <param name="Type">all | documents | articles | audio | videos.</param>
public record GetLibraryQuery(
    Guid UserId,
    string Type,
    Guid? CourseId,
    string? Search,
    int Page,
    int PageSize,
    IReadOnlyList<Guid>? TagIds = null) : IRequest<Result<PaginatedList<LibraryItemDto>>>;

public class GetLibraryQueryHandler : IRequestHandler<GetLibraryQuery, Result<PaginatedList<LibraryItemDto>>>
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "all", "documents", "articles", "audio", "videos",
    };

    private readonly ILibraryRepository _library;
    private readonly IUnitOfWork _unitOfWork;

    public GetLibraryQueryHandler(ILibraryRepository library, IUnitOfWork unitOfWork)
    {
        _library = library;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedList<LibraryItemDto>>> Handle(GetLibraryQuery request, CancellationToken cancellationToken)
    {
        var type = AllowedTypes.Contains(request.Type) ? request.Type.ToLowerInvariant() : "all";
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize is < 1 or > 100 ? 8 : request.PageSize;

        var (items, totalCount) = await _library.GetPagedAsync(
            request.UserId, type, request.CourseId, request.Search, page, pageSize,
            request.TagIds, cancellationToken);

        // One lookup for the whole page rather than a join in the union: the union's two operands
        // must project identical shapes, and an item with three tags would otherwise appear three
        // times and throw the page count off.
        var tagsByItem = await _unitOfWork.LibraryTags.GetAssignmentsAsync(
            request.UserId,
            items.Select(i => (i.Kind, i.Id)).ToList(),
            cancellationToken);

        var dtos = items.Select(i => new LibraryItemDto(
            i.Kind,
            i.Id,
            i.CourseId,
            i.CourseName,
            i.CourseColor,
            i.CreatedAt,
            i.FileName,
            i.BlobUrl,
            i.ContentType,
            i.FileSize,
            i.FileHash,
            i.OriginalUrl,
            i.Summary,
            i.Title,
            i.VideoId,
            i.VideoUrl,
            i.ThumbnailUrl,
            i.SourceType,
            tagsByItem.TryGetValue((i.Kind, i.Id), out var tags)
                ? tags.Select(t => new LibraryItemTagDto(t.LibraryTagId, t.Name, t.Kind, t.Color)).ToList()
                : Array.Empty<LibraryItemTagDto>()));

        return Result<PaginatedList<LibraryItemDto>>.Success(
            new PaginatedList<LibraryItemDto>(dtos, totalCount, page, pageSize));
    }
}
