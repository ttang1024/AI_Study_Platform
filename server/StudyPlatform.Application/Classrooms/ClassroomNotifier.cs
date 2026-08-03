using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

/// <summary>
/// Push for the two moments a classroom needs to reach out of the app: work being set, and a grade
/// coming back. Both are things the other party cannot discover by looking — a student has no reason
/// to open a classroom on the off-chance an assignment appeared.
///
/// Every method here swallows its own failures. Push is a best-effort side channel with no VAPID keys
/// in many deployments, and a notification that could not be delivered must never be the reason a
/// grade fails to save. That follows the platform's "degrade, don't fail" rule.
/// </summary>
internal static class ClassroomNotifier
{
    /// <summary>Tells every active student that an assignment has been published.</summary>
    public static async Task AssignmentPublishedAsync(
        IUnitOfWork unitOfWork,
        IPushNotificationService push,
        Classroom classroom,
        ClassroomAssignment assignment,
        CancellationToken cancellationToken)
    {
        try
        {
            var studentIds = (await unitOfWork.ClassroomEnrollments.FindAsNoTrackingAsync(
                    e => e.ClassroomId == assignment.ClassroomId
                         && e.RemovedAt == null
                         && e.Role == ClassroomRoles.Student,
                    cancellationToken))
                .Select(e => e.UserId)
                .ToList();

            var due = assignment.DueAt is { } dueAt
                ? $" Due {dueAt:MMM d}."
                : string.Empty;

            var url = $"/classrooms/{assignment.ClassroomId}";

            foreach (var studentId in studentIds)
            {
                await push.SendToUserAsync(
                    studentId,
                    $"New assignment in {classroom.Name}",
                    $"{assignment.Title}.{due}",
                    url,
                    cancellationToken);
            }
        }
        catch
        {
            // Best effort — the assignment is already published either way.
        }
    }

    /// <summary>Tells one student their work has been marked. Clearing a grade sends nothing.</summary>
    public static async Task GradeReleasedAsync(
        IPushNotificationService push,
        Classroom classroom,
        ClassroomAssignment assignment,
        Guid studentUserId,
        double pointsAwarded,
        CancellationToken cancellationToken)
    {
        try
        {
            await push.SendToUserAsync(
                studentUserId,
                $"Your work has been graded",
                $"{assignment.Title} in {classroom.Name}: " +
                $"{pointsAwarded:0.##}/{assignment.PointsPossible:0.##}.",
                $"/classrooms/{classroom.ClassroomId}",
                cancellationToken);
        }
        catch
        {
            // Best effort — the grade is already released.
        }
    }
}
