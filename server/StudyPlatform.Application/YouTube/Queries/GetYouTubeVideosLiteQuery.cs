using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Queries;

public record GetYouTubeVideosLiteQuery(
    Guid UserId,
    int Page,
    int PageSize) : IRequest<Result<YouTubeVideoLitePagedResult>>;

public class GetYouTubeVideosLiteQueryHandler : IRequestHandler<GetYouTubeVideosLiteQuery, Result<YouTubeVideoLitePagedResult>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetYouTubeVideosLiteQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<YouTubeVideoLitePagedResult>> Handle(GetYouTubeVideosLiteQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _unitOfWork.YouTubeVideos.GetPagedLiteAsync(
            request.UserId, request.Page, request.PageSize, cancellationToken);

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        var dtos = items.Select(i => new YouTubeVideoLiteDto(
            i.Id, i.CourseId, i.CourseName, i.CourseColor, i.VideoId, i.VideoUrl,
            i.SourceType, i.Title, i.ThumbnailUrl, i.CreatedAt));

        return Result<YouTubeVideoLitePagedResult>.Success(
            new YouTubeVideoLitePagedResult(dtos, totalCount, request.Page, request.PageSize, totalPages));
    }
}
