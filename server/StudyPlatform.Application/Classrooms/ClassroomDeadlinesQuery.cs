using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

/// <summary>
/// What a student still owes their classrooms, and when.
///
/// This exists because "when is my classwork due" was being answered nowhere: the classroom detail
/// page knew, and nothing else did — not the notification digest, not the calendar feed. Rather than
/// let each of those grow its own idea of what counts as outstanding, they all read this.
///
/// Student-only by construction. Teaching staff have no work due to themselves, and an instructor
/// seeing their own assignment in their calendar as homework would be noise.
/// </summary>
public record ClassroomDeadlineDto(
    Guid ClassroomId,
    string ClassroomName,
    /// <summary>Null when the deadline comes from an assigned course rather than an assignment.</summary>
    Guid? ClassroomAssignmentId,
    Guid? CourseId,
    string Title,
    DateTime DueAt,
    /// <summary>A <see cref="SubmissionStatus"/> value for assignments, "course" for course deadlines.</summary>
    string Status,
    bool IsOverdue);

public record GetClassroomDeadlinesQuery(Guid UserId, int HorizonDays = 14)
    : IRequest<Result<IReadOnlyList<ClassroomDeadlineDto>>>;

public class GetClassroomDeadlinesQueryHandler
    : IRequestHandler<GetClassroomDeadlinesQuery, Result<IReadOnlyList<ClassroomDeadlineDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetClassroomDeadlinesQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IReadOnlyList<ClassroomDeadlineDto>>> Handle(
        GetClassroomDeadlinesQuery request, CancellationToken cancellationToken)
    {
        var empty = (IReadOnlyList<ClassroomDeadlineDto>)Array.Empty<ClassroomDeadlineDto>();

        var enrollments = (await _unitOfWork.ClassroomEnrollments.FindAsNoTrackingAsync(
                e => e.UserId == request.UserId
                     && e.RemovedAt == null
                     && e.Role == ClassroomRoles.Student,
                cancellationToken))
            .ToList();

        if (enrollments.Count == 0) return Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(empty);

        var classroomIds = enrollments.Select(e => e.ClassroomId).ToList();

        // An archived classroom is finished; its deadlines have stopped meaning anything.
        var classrooms = (await _unitOfWork.Classrooms.FindAsNoTrackingAsync(
                c => classroomIds.Contains(c.ClassroomId) && c.ArchivedAt == null, cancellationToken))
            .ToDictionary(c => c.ClassroomId, c => c.Name);

        if (classrooms.Count == 0) return Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(empty);

        var liveIds = classrooms.Keys.ToList();
        var now = DateTime.UtcNow;
        var horizon = now.AddDays(request.HorizonDays);

        var items = new List<ClassroomDeadlineDto>();

        // ── Assignments ─────────────────────────────────────────────────────
        // Overdue work stays on the list rather than disappearing at midnight: something a student
        // missed is more worth showing than something they have a week to do.
        var assignments = (await _unitOfWork.ClassroomAssignments.FindAsNoTrackingAsync(
                a => liveIds.Contains(a.ClassroomId)
                     && a.PublishedAt != null
                     && a.DueAt != null
                     && a.DueAt < horizon,
                cancellationToken))
            .ToList();

        if (assignments.Count > 0)
        {
            var submissions = (await _unitOfWork.ClassroomSubmissions.GetForStudentAcrossAsync(
                    assignments.Select(a => a.ClassroomAssignmentId), request.UserId, cancellationToken))
                .ToDictionary(s => s.ClassroomAssignmentId);

            foreach (var a in assignments)
            {
                var mine = submissions.GetValueOrDefault(a.ClassroomAssignmentId);

                // Handed in is handed in — waiting on a grade is not something to chase the student for.
                if (mine?.SubmittedAt != null) continue;

                items.Add(new ClassroomDeadlineDto(
                    a.ClassroomId,
                    classrooms[a.ClassroomId],
                    a.ClassroomAssignmentId,
                    a.CourseId,
                    a.Title,
                    a.DueAt!.Value,
                    SubmissionStatus.Resolve(mine, a.DueAt),
                    a.DueAt.Value < now));
            }
        }

        // ── Assigned courses ────────────────────────────────────────────────
        // A course deadline has no submission to complete against, so it is reported as-is and only
        // while it is still ahead — a passed course due date is not actionable the way missed work is.
        var courseLinks = (await _unitOfWork.ClassroomCourses.FindAsNoTrackingAsync(
                cc => liveIds.Contains(cc.ClassroomId)
                      && cc.DueAt != null
                      && cc.DueAt >= now
                      && cc.DueAt < horizon,
                cancellationToken))
            .ToList();

        if (courseLinks.Count > 0)
        {
            var courseIds = courseLinks.Select(cc => cc.CourseId).Distinct().ToList();
            var courseNames = (await _unitOfWork.Courses.FindAsNoTrackingAsync(
                    c => courseIds.Contains(c.CourseId), cancellationToken))
                .ToDictionary(c => c.CourseId, c => c.CourseName);

            foreach (var cc in courseLinks)
            {
                items.Add(new ClassroomDeadlineDto(
                    cc.ClassroomId,
                    classrooms[cc.ClassroomId],
                    null,
                    cc.CourseId,
                    courseNames.GetValueOrDefault(cc.CourseId, "Assigned course"),
                    cc.DueAt!.Value,
                    "course",
                    false));
            }
        }

        return Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(
            items.OrderBy(i => i.DueAt).ToList());
    }
}
