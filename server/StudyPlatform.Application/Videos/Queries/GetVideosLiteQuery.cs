using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Queries;

public record GetVideosLiteQuery(
    Guid UserId,
    int Page,
    int PageSize) : IRequest<Result<VideoLitePagedResult>>;

public class GetVideosLiteQueryHandler : IRequestHandler<GetVideosLiteQuery, Result<VideoLitePagedResult>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetVideosLiteQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<VideoLitePagedResult>> Handle(GetVideosLiteQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _unitOfWork.Videos.GetPagedLiteAsync(
            request.UserId, request.Page, request.PageSize, cancellationToken);

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        var dtos = items.Select(i => new VideoLiteDto(
            i.Id, i.CourseId, i.CourseName, i.CourseColor, i.VideoId, i.VideoUrl,
            i.SourceType, i.Title, i.ThumbnailUrl, i.CreatedAt));

        return Result<VideoLitePagedResult>.Success(
            new VideoLitePagedResult(dtos, totalCount, request.Page, request.PageSize, totalPages));
    }
}
