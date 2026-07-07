using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Queries;

public record GetVideoByIdQuery(Guid Id, Guid UserId) : IRequest<Result<VideoDto>>;

public class GetVideoByIdQueryHandler : IRequestHandler<GetVideoByIdQuery, Result<VideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetVideoByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<VideoDto>> Handle(GetVideoByIdQuery request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);

        if (video is null)
        {
            // Check if the video belongs to a course shared with one of the user's study groups
            video = await _unitOfWork.Videos.GetByIdWithCourseAsync(request.Id, cancellationToken);
            if (video is null)
                return Result<VideoDto>.Failure("Video not found.", "NOT_FOUND");

            var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == video.CourseId, cancellationToken);
            var groupIds = shared.Select(sc => sc.GroupId).ToList();
            var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
                m => groupIds.Contains(m.GroupId) && m.UserId == request.UserId, cancellationToken);
            if (!hasGroupAccess)
                return Result<VideoDto>.Failure("Video not found.", "NOT_FOUND");
        }

        return Result<VideoDto>.Success(SaveVideoCommandHandler.ToDto(video));
    }
}
