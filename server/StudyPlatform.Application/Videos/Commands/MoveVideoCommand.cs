using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record MoveVideoCommand(Guid VideoId, Guid UserId, Guid TargetCourseId) : IRequest<Result<VideoDto>>;

public class MoveVideoCommandHandler : IRequestHandler<MoveVideoCommand, Result<VideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public MoveVideoCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<VideoDto>> Handle(MoveVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null) return Result<VideoDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var courseExists = await _unitOfWork.Courses.BelongsToUserAsync(request.TargetCourseId, request.UserId, cancellationToken);
        if (!courseExists) return Result<VideoDto>.Failure("Target course not found.", "COURSE_NOT_FOUND");

        video.CourseId = request.TargetCourseId;
        video.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Videos.GetByIdForUserAsync(video.VideoId, request.UserId, cancellationToken);
        return Result<VideoDto>.Success(SaveVideoCommandHandler.ToDto(saved!));
    }
}
