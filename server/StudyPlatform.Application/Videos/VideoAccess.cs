using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos;

/// <summary>Which saved videos a user may read: their own, plus those in a course shared with one of their study groups.</summary>
public interface IVideoAccess
{
    Task<Video?> GetAccessibleVideoAsync(Guid videoId, Guid userId, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IVideoAccess"/>
public sealed class VideoAccess : IVideoAccess
{
    private readonly IVideoRepository _videos;
    private readonly ICourseAccess _courseAccess;

    public VideoAccess(IVideoRepository videos, ICourseAccess courseAccess)
    {
        _videos = videos;
        _courseAccess = courseAccess;
    }

    public async Task<Video?> GetAccessibleVideoAsync(Guid videoId, Guid userId, CancellationToken cancellationToken)
    {
        var video = await _videos.GetByIdForUserAsync(videoId, userId, cancellationToken);
        if (video is not null)
            return video;

        video = await _videos.GetByIdWithCourseAsync(videoId, cancellationToken);
        if (video is null)
            return null;

        return await _courseAccess.HasSharedCourseAccessAsync(userId, video.CourseId, cancellationToken) ? video : null;
    }
}
