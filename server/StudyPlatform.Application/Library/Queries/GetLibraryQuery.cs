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
    int PageSize) : IRequest<Result<PaginatedList<LibraryItemDto>>>;

public class GetLibraryQueryHandler : IRequestHandler<GetLibraryQuery, Result<PaginatedList<LibraryItemDto>>>
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "all", "documents", "articles", "audio", "videos",
    };

    private readonly ILibraryRepository _library;

    public GetLibraryQueryHandler(ILibraryRepository library) => _library = library;

    public async Task<Result<PaginatedList<LibraryItemDto>>> Handle(GetLibraryQuery request, CancellationToken cancellationToken)
    {
        var type = AllowedTypes.Contains(request.Type) ? request.Type.ToLowerInvariant() : "all";
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize is < 1 or > 100 ? 8 : request.PageSize;

        var (items, totalCount) = await _library.GetPagedAsync(
            request.UserId, type, request.CourseId, request.Search, page, pageSize, cancellationToken);

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
            i.Title,
            i.VideoId,
            i.VideoUrl,
            i.ThumbnailUrl,
            i.SourceType));

        return Result<PaginatedList<LibraryItemDto>>.Success(
            new PaginatedList<LibraryItemDto>(dtos, totalCount, page, pageSize));
    }
}
