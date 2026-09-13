using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Common;

/// <summary>
/// Read access to another user's course through a study group that the course is shared with.
/// Ownership is checked by the caller; this only answers "is the user in a group this course is
/// shared to?", which is the one cross-user read path documents, videos and courses all allow.
/// </summary>
public static class CourseAccess
{
    public static async Task<bool> HasSharedCourseAccessAsync(
        this IUnitOfWork unitOfWork, Guid userId, Guid courseId, CancellationToken cancellationToken)
    {
        var shared = await unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, cancellationToken);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, cancellationToken);
    }
}
