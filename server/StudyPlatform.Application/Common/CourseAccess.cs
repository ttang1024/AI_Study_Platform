using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Common;

/// <summary>
/// Read access to another user's course through a study group that the course is shared with.
/// Ownership is checked by the caller; this only answers "is the user in a group this course is
/// shared to?", which is the one cross-user read path documents, videos and courses all allow.
/// </summary>
public interface ICourseAccess
{
    Task<bool> HasSharedCourseAccessAsync(Guid userId, Guid courseId, CancellationToken cancellationToken);
}

/// <inheritdoc cref="ICourseAccess"/>
public sealed class CourseAccess : ICourseAccess
{
    private readonly IStudyGroupSharedCourseRepository _sharedCourses;
    private readonly IStudyGroupMemberRepository _members;

    public CourseAccess(IStudyGroupSharedCourseRepository sharedCourses, IStudyGroupMemberRepository members)
    {
        _sharedCourses = sharedCourses;
        _members = members;
    }

    public async Task<bool> HasSharedCourseAccessAsync(Guid userId, Guid courseId, CancellationToken cancellationToken)
    {
        var shared = await _sharedCourses.FindAsync(sc => sc.CourseId == courseId, cancellationToken);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _members.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, cancellationToken);
    }
}
