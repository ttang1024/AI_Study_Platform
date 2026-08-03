using FluentValidation;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

// The hand-in loop: an instructor sets work, students submit privately, staff grade it back.
//
// Every handler here decides visibility from the caller's classroom role, never from the route, and
// the two directions are asymmetric on purpose:
//   staff  → may read every submission on an assignment, and are the only ones who can score one
//   student → may read and write exactly one submission, their own, and never sees a classmate's
//
// That asymmetry is the whole reason classrooms are a separate aggregate from study groups.

// ── DTOs ────────────────────────────────────────────────────────────────────

/// <summary>
/// An assignment as one caller sees it. The tail fields are role-dependent and null for the other
/// side — students never receive submission counts, staff have no "my status".
/// </summary>
public record ClassroomAssignmentDto(
    Guid ClassroomAssignmentId,
    Guid ClassroomId,
    string Title,
    string? Instructions,
    Guid? CourseId,
    string? CourseName,
    double PointsPossible,
    DateTime? DueAt,
    bool AllowLateSubmissions,
    bool IsPublished,
    DateTime CreatedAt,
    // Student view: one of SubmissionStatus.
    string? MyStatus,
    double? MyPointsAwarded,
    // Staff view: how many students have handed in, and how many of those are graded.
    int? SubmittedCount,
    int? GradedCount,
    int? StudentCount);

public record ClassroomSubmissionDto(
    Guid? ClassroomSubmissionId,
    Guid ClassroomAssignmentId,
    Guid StudentUserId,
    string StudentName,
    string Text,
    string Status,
    DateTime? SubmittedAt,
    double? PointsAwarded,
    string? Feedback,
    DateTime? GradedAt);

public record ClassroomAssignmentDetailDto(
    ClassroomAssignmentDto Assignment,
    // The caller's own submission. Null for staff, and for a student who has not started.
    ClassroomSubmissionDto? MySubmission,
    // Every student's submission, roster order. Null for students — the field is absent, not empty.
    IEnumerable<ClassroomSubmissionDto>? Submissions);

// ── Shared mapping ──────────────────────────────────────────────────────────

internal static class AssignmentMapping
{
    public static ClassroomAssignmentDto ForStudent(
        ClassroomAssignment a, string? courseName, ClassroomSubmission? mine) => new(
        a.ClassroomAssignmentId, a.ClassroomId, a.Title, a.Instructions, a.CourseId, courseName,
        a.PointsPossible, a.DueAt, a.AllowLateSubmissions, a.PublishedAt != null, a.CreatedAt,
        SubmissionStatus.Resolve(mine, a.DueAt),
        // A grade is only a grade once it has been released.
        mine?.GradedAt != null ? mine.PointsAwarded : null,
        null, null, null);

    public static ClassroomAssignmentDto ForStaff(
        ClassroomAssignment a, string? courseName,
        int submittedCount, int gradedCount, int studentCount) => new(
        a.ClassroomAssignmentId, a.ClassroomId, a.Title, a.Instructions, a.CourseId, courseName,
        a.PointsPossible, a.DueAt, a.AllowLateSubmissions, a.PublishedAt != null, a.CreatedAt,
        null, null, submittedCount, gradedCount, studentCount);

    public static ClassroomSubmissionDto ToDto(
        ClassroomSubmission s, string studentName, DateTime? dueAt) => new(
        s.ClassroomSubmissionId, s.ClassroomAssignmentId, s.StudentUserId, studentName,
        s.Text, SubmissionStatus.Resolve(s, dueAt), s.SubmittedAt,
        s.PointsAwarded, s.Feedback, s.GradedAt);

    /// <summary>A roster entry with nothing handed in yet. Carries no row id — none exists.</summary>
    public static ClassroomSubmissionDto Placeholder(Guid assignmentId, Guid studentUserId, string studentName) => new(
        null, assignmentId, studentUserId, studentName,
        string.Empty, SubmissionStatus.NotStarted, null, null, null, null);
}

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetClassroomAssignmentsQuery(Guid UserId, Guid ClassroomId)
    : IRequest<Result<IEnumerable<ClassroomAssignmentDto>>>;

public class GetClassroomAssignmentsQueryHandler
    : IRequestHandler<GetClassroomAssignmentsQuery, Result<IEnumerable<ClassroomAssignmentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetClassroomAssignmentsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<ClassroomAssignmentDto>>> Handle(
        GetClassroomAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireMemberAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
        if (!access.IsSuccess)
            return Result<IEnumerable<ClassroomAssignmentDto>>.Failure(access.Message, access.ErrorCode);

        var isStaff = ClassroomRoles.CanGrade(access.Data!);

        var assignments = (await _unitOfWork.ClassroomAssignments
            .GetByClassroomAsync(request.ClassroomId, cancellationToken)).ToList();

        // Drafts are the instructor's private workspace.
        if (!isStaff)
            assignments = assignments.Where(a => a.PublishedAt != null).ToList();

        if (assignments.Count == 0)
            return Result<IEnumerable<ClassroomAssignmentDto>>.Success(Array.Empty<ClassroomAssignmentDto>());

        var courseNames = await ResolveCourseNamesAsync(_unitOfWork, assignments, cancellationToken);

        if (!isStaff)
        {
            var mine = (await _unitOfWork.ClassroomSubmissions.GetForStudentAcrossAsync(
                    assignments.Select(a => a.ClassroomAssignmentId), request.UserId, cancellationToken))
                .ToDictionary(s => s.ClassroomAssignmentId);

            return Result<IEnumerable<ClassroomAssignmentDto>>.Success(assignments.Select(a =>
                AssignmentMapping.ForStudent(
                    a, courseNames.GetValueOrDefault(a.CourseId ?? Guid.Empty),
                    mine.GetValueOrDefault(a.ClassroomAssignmentId))));
        }

        var studentCount = await _unitOfWork.ClassroomEnrollments.CountAsync(
            e => e.ClassroomId == request.ClassroomId
                 && e.RemovedAt == null
                 && e.Role == ClassroomRoles.Student,
            cancellationToken);

        var assignmentIds = assignments.Select(a => a.ClassroomAssignmentId).ToList();
        var submissions = (await _unitOfWork.ClassroomSubmissions.FindAsNoTrackingAsync(
                s => assignmentIds.Contains(s.ClassroomAssignmentId), cancellationToken))
            .ToList();

        var dtos = assignments.Select(a =>
        {
            var forThis = submissions.Where(s => s.ClassroomAssignmentId == a.ClassroomAssignmentId).ToList();
            return AssignmentMapping.ForStaff(
                a, courseNames.GetValueOrDefault(a.CourseId ?? Guid.Empty),
                forThis.Count(s => s.SubmittedAt != null),
                forThis.Count(s => s.GradedAt != null),
                studentCount);
        });

        return Result<IEnumerable<ClassroomAssignmentDto>>.Success(dtos);
    }

    internal static async Task<Dictionary<Guid, string>> ResolveCourseNamesAsync(
        IUnitOfWork unitOfWork, IEnumerable<ClassroomAssignment> assignments, CancellationToken cancellationToken)
    {
        var courseIds = assignments
            .Where(a => a.CourseId != null)
            .Select(a => a.CourseId!.Value)
            .Distinct()
            .ToList();

        if (courseIds.Count == 0) return new Dictionary<Guid, string>();

        // Read through Courses directly: the assignment already proves the course was assigned to this
        // classroom, and the per-user ownership filter used elsewhere would hide it from students.
        var courses = await unitOfWork.Courses.FindAsNoTrackingAsync(
            c => courseIds.Contains(c.CourseId), cancellationToken);

        return courses.ToDictionary(c => c.CourseId, c => c.CourseName);
    }
}

public record GetClassroomAssignmentDetailQuery(Guid UserId, Guid ClassroomId, Guid ClassroomAssignmentId)
    : IRequest<Result<ClassroomAssignmentDetailDto>>;

public class GetClassroomAssignmentDetailQueryHandler
    : IRequestHandler<GetClassroomAssignmentDetailQuery, Result<ClassroomAssignmentDetailDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetClassroomAssignmentDetailQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomAssignmentDetailDto>> Handle(
        GetClassroomAssignmentDetailQuery request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireMemberAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomAssignmentDetailDto>.Failure(access.Message, access.ErrorCode);

        var isStaff = ClassroomRoles.CanGrade(access.Data!);

        var assignment = await _unitOfWork.ClassroomAssignments
            .GetByIdAsync(request.ClassroomAssignmentId, cancellationToken);

        // The classroom id from the route is not trusted to match the assignment's own.
        if (assignment == null || assignment.ClassroomId != request.ClassroomId)
            return Result<ClassroomAssignmentDetailDto>.Failure("Assignment not found.", "NOT_FOUND");

        if (!isStaff && assignment.PublishedAt == null)
            return Result<ClassroomAssignmentDetailDto>.Failure("Assignment not found.", "NOT_FOUND");

        var courseNames = await GetClassroomAssignmentsQueryHandler
            .ResolveCourseNamesAsync(_unitOfWork, new[] { assignment }, cancellationToken);
        var courseName = courseNames.GetValueOrDefault(assignment.CourseId ?? Guid.Empty);

        if (!isStaff)
        {
            var mine = await _unitOfWork.ClassroomSubmissions.GetForStudentAsync(
                assignment.ClassroomAssignmentId, request.UserId, cancellationToken);

            return Result<ClassroomAssignmentDetailDto>.Success(new ClassroomAssignmentDetailDto(
                AssignmentMapping.ForStudent(assignment, courseName, mine),
                mine == null ? null : AssignmentMapping.ToDto(mine, string.Empty, assignment.DueAt),
                // Explicitly null, not empty: a student is not being told there are zero classmates.
                null));
        }

        var classroom = await _unitOfWork.Classrooms.GetWithRosterAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<ClassroomAssignmentDetailDto>.Failure("Classroom not found.", "NOT_FOUND");

        var withSubmissions = await _unitOfWork.ClassroomAssignments
            .GetWithSubmissionsAsync(assignment.ClassroomAssignmentId, cancellationToken);
        var submissions = withSubmissions?.Submissions ?? new List<ClassroomSubmission>();

        // Every active student gets a row, so an instructor can see who has not started at all.
        var rows = classroom.Enrollments
            .Where(e => e.RemovedAt == null && e.Role == ClassroomRoles.Student)
            .OrderBy(e => e.User.FullName)
            .Select(e =>
            {
                var submission = submissions.FirstOrDefault(s => s.StudentUserId == e.UserId);
                return submission == null
                    ? AssignmentMapping.Placeholder(assignment.ClassroomAssignmentId, e.UserId, e.User.FullName)
                    // A draft still belongs to the student alone: staff learn it exists, not what it says.
                    : submission.SubmittedAt == null
                        ? AssignmentMapping.Placeholder(assignment.ClassroomAssignmentId, e.UserId, e.User.FullName)
                            with { Status = SubmissionStatus.Draft, ClassroomSubmissionId = submission.ClassroomSubmissionId }
                        : AssignmentMapping.ToDto(submission, e.User.FullName, assignment.DueAt);
            })
            .ToList();

        return Result<ClassroomAssignmentDetailDto>.Success(new ClassroomAssignmentDetailDto(
            AssignmentMapping.ForStaff(
                assignment, courseName,
                submissions.Count(s => s.SubmittedAt != null),
                submissions.Count(s => s.GradedAt != null),
                rows.Count),
            null,
            rows));
    }
}

// ── Authoring commands (instructor only) ────────────────────────────────────

public record CreateClassroomAssignmentCommand(
    Guid UserId,
    Guid ClassroomId,
    string Title,
    string? Instructions,
    Guid? CourseId,
    double PointsPossible,
    DateTime? DueAt,
    bool AllowLateSubmissions,
    bool Publish) : IRequest<Result<ClassroomAssignmentDto>>;

public class CreateClassroomAssignmentCommandValidator : AbstractValidator<CreateClassroomAssignmentCommand>
{
    public CreateClassroomAssignmentCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Instructions).MaximumLength(20000);
        RuleFor(x => x.PointsPossible).GreaterThan(0).LessThanOrEqualTo(10000);
    }
}

public class CreateClassroomAssignmentCommandHandler
    : IRequestHandler<CreateClassroomAssignmentCommand, Result<ClassroomAssignmentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPushNotificationService _push;

    public CreateClassroomAssignmentCommandHandler(IUnitOfWork unitOfWork, IPushNotificationService push)
    {
        _unitOfWork = unitOfWork;
        _push = push;
    }

    public async Task<Result<ClassroomAssignmentDto>> Handle(
        CreateClassroomAssignmentCommand request, CancellationToken cancellationToken)
    {
        var guard = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!guard.IsSuccess)
            return Result<ClassroomAssignmentDto>.Failure(guard.Message, guard.ErrorCode);

        var courseCheck = await AssignmentGuards.ResolveCourseAsync(
            _unitOfWork, request.ClassroomId, request.CourseId, cancellationToken);
        if (!courseCheck.IsSuccess)
            return Result<ClassroomAssignmentDto>.Failure(courseCheck.Message, courseCheck.ErrorCode);

        var now = DateTime.UtcNow;
        var assignment = new ClassroomAssignment
        {
            ClassroomAssignmentId = Guid.NewGuid(),
            ClassroomId = request.ClassroomId,
            CreatedByUserId = request.UserId,
            Title = request.Title.Trim(),
            Instructions = request.Instructions?.Trim(),
            CourseId = request.CourseId,
            PointsPossible = request.PointsPossible,
            DueAt = request.DueAt,
            AllowLateSubmissions = request.AllowLateSubmissions,
            PublishedAt = request.Publish ? now : null,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _unitOfWork.ClassroomAssignments.AddAsync(assignment, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Nothing is submitted yet, but the class is not empty — the panel needs the denominator.
        var studentCount = await _unitOfWork.ClassroomEnrollments.CountAsync(
            e => e.ClassroomId == request.ClassroomId
                 && e.RemovedAt == null
                 && e.Role == ClassroomRoles.Student,
            cancellationToken);

        // Only a published assignment is news. A draft is not visible to students yet.
        if (assignment.PublishedAt != null)
        {
            var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
            if (classroom != null)
                await ClassroomNotifier.AssignmentPublishedAsync(
                    _unitOfWork, _push, classroom, assignment, cancellationToken);
        }

        return Result<ClassroomAssignmentDto>.Success(
            AssignmentMapping.ForStaff(assignment, courseCheck.Data, 0, 0, studentCount),
            request.Publish ? "Assignment published." : "Draft saved.");
    }
}

public record UpdateClassroomAssignmentCommand(
    Guid UserId,
    Guid ClassroomId,
    Guid ClassroomAssignmentId,
    string Title,
    string? Instructions,
    Guid? CourseId,
    double PointsPossible,
    DateTime? DueAt,
    bool AllowLateSubmissions,
    bool Publish) : IRequest<Result<ClassroomAssignmentDto>>;

public class UpdateClassroomAssignmentCommandValidator : AbstractValidator<UpdateClassroomAssignmentCommand>
{
    public UpdateClassroomAssignmentCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Instructions).MaximumLength(20000);
        RuleFor(x => x.PointsPossible).GreaterThan(0).LessThanOrEqualTo(10000);
    }
}

public class UpdateClassroomAssignmentCommandHandler
    : IRequestHandler<UpdateClassroomAssignmentCommand, Result<ClassroomAssignmentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPushNotificationService _push;

    public UpdateClassroomAssignmentCommandHandler(IUnitOfWork unitOfWork, IPushNotificationService push)
    {
        _unitOfWork = unitOfWork;
        _push = push;
    }

    public async Task<Result<ClassroomAssignmentDto>> Handle(
        UpdateClassroomAssignmentCommand request, CancellationToken cancellationToken)
    {
        var guard = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!guard.IsSuccess)
            return Result<ClassroomAssignmentDto>.Failure(guard.Message, guard.ErrorCode);

        var assignment = await _unitOfWork.ClassroomAssignments
            .GetByIdAsync(request.ClassroomAssignmentId, cancellationToken);
        if (assignment == null || assignment.ClassroomId != request.ClassroomId)
            return Result<ClassroomAssignmentDto>.Failure("Assignment not found.", "NOT_FOUND");

        var courseCheck = await AssignmentGuards.ResolveCourseAsync(
            _unitOfWork, request.ClassroomId, request.CourseId, cancellationToken);
        if (!courseCheck.IsSuccess)
            return Result<ClassroomAssignmentDto>.Failure(courseCheck.Message, courseCheck.ErrorCode);

        assignment.Title = request.Title.Trim();
        assignment.Instructions = request.Instructions?.Trim();
        assignment.CourseId = request.CourseId;
        assignment.PointsPossible = request.PointsPossible;
        assignment.DueAt = request.DueAt;
        assignment.AllowLateSubmissions = request.AllowLateSubmissions;

        // Publishing is one-way. Un-publishing would strand any submission already made against it,
        // so the only way back is to delete the assignment outright.
        var justPublished = request.Publish && assignment.PublishedAt == null;
        if (justPublished)
            assignment.PublishedAt = DateTime.UtcNow;

        assignment.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.ClassroomAssignments.Update(assignment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var submissions = await _unitOfWork.ClassroomSubmissions.FindAsNoTrackingAsync(
            s => s.ClassroomAssignmentId == assignment.ClassroomAssignmentId, cancellationToken);
        var list = submissions.ToList();

        // The roster size has to be counted, not assumed: the panel renders "n of N handed in" straight
        // from this response, so returning 0 here made every edit report the class as empty.
        var studentCount = await _unitOfWork.ClassroomEnrollments.CountAsync(
            e => e.ClassroomId == request.ClassroomId
                 && e.RemovedAt == null
                 && e.Role == ClassroomRoles.Student,
            cancellationToken);

        // Only the draft→published transition is news. Editing a live assignment must not re-notify
        // the class every time a typo is fixed.
        if (justPublished)
        {
            var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
            if (classroom != null)
                await ClassroomNotifier.AssignmentPublishedAsync(
                    _unitOfWork, _push, classroom, assignment, cancellationToken);
        }

        return Result<ClassroomAssignmentDto>.Success(
            AssignmentMapping.ForStaff(
                assignment, courseCheck.Data,
                list.Count(s => s.SubmittedAt != null),
                list.Count(s => s.GradedAt != null),
                studentCount),
            "Assignment updated.");
    }
}

public record DeleteClassroomAssignmentCommand(Guid UserId, Guid ClassroomId, Guid ClassroomAssignmentId)
    : IRequest<Result<bool>>;

public class DeleteClassroomAssignmentCommandHandler
    : IRequestHandler<DeleteClassroomAssignmentCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteClassroomAssignmentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(
        DeleteClassroomAssignmentCommand request, CancellationToken cancellationToken)
    {
        var guard = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!guard.IsSuccess)
            return Result<bool>.Failure(guard.Message, guard.ErrorCode);

        var assignment = await _unitOfWork.ClassroomAssignments
            .GetByIdAsync(request.ClassroomAssignmentId, cancellationToken);
        if (assignment == null || assignment.ClassroomId != request.ClassroomId)
            return Result<bool>.Failure("Assignment not found.", "NOT_FOUND");

        // Submissions cascade with the assignment. Deleting one that has been handed in destroys
        // student work, so that route is closed — archive the classroom instead.
        var handedIn = await _unitOfWork.ClassroomSubmissions.CountAsync(
            s => s.ClassroomAssignmentId == assignment.ClassroomAssignmentId && s.SubmittedAt != null,
            cancellationToken);

        if (handedIn > 0)
            return Result<bool>.Failure(
                "Students have already submitted to this assignment, so it cannot be deleted.",
                "HAS_SUBMISSIONS");

        _unitOfWork.ClassroomAssignments.Remove(assignment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Assignment deleted.");
    }
}

// ── Student command ─────────────────────────────────────────────────────────

public record SaveClassroomSubmissionCommand(
    Guid UserId, Guid ClassroomId, Guid ClassroomAssignmentId, string Text, bool Submit)
    : IRequest<Result<ClassroomSubmissionDto>>;

public class SaveClassroomSubmissionCommandValidator : AbstractValidator<SaveClassroomSubmissionCommand>
{
    public SaveClassroomSubmissionCommandValidator()
    {
        RuleFor(x => x.Text).MaximumLength(100000);
        RuleFor(x => x.Text).NotEmpty().When(x => x.Submit)
            .WithMessage("There is nothing to hand in yet.");
    }
}

public class SaveClassroomSubmissionCommandHandler
    : IRequestHandler<SaveClassroomSubmissionCommand, Result<ClassroomSubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SaveClassroomSubmissionCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomSubmissionDto>> Handle(
        SaveClassroomSubmissionCommand request, CancellationToken cancellationToken)
    {
        var guard = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: false, cancellationToken);
        if (!guard.IsSuccess)
            return Result<ClassroomSubmissionDto>.Failure(guard.Message, guard.ErrorCode);

        // Staff have no submission row on their own assignments — there would be nobody to grade it.
        if (ClassroomRoles.CanGrade(guard.Data!))
            return Result<ClassroomSubmissionDto>.Failure(
                "Teaching staff do not submit to their own assignments.", "FORBIDDEN");

        var assignment = await _unitOfWork.ClassroomAssignments
            .GetByIdAsync(request.ClassroomAssignmentId, cancellationToken);
        if (assignment == null || assignment.ClassroomId != request.ClassroomId || assignment.PublishedAt == null)
            return Result<ClassroomSubmissionDto>.Failure("Assignment not found.", "NOT_FOUND");

        var now = DateTime.UtcNow;
        var isLate = assignment.DueAt != null && now > assignment.DueAt;

        // A draft can still be saved after the deadline; only handing in is refused, so a student who
        // ran out of time does not also lose what they wrote.
        if (request.Submit && isLate && !assignment.AllowLateSubmissions)
            return Result<ClassroomSubmissionDto>.Failure(
                "The deadline for this assignment has passed.", "PAST_DUE");

        var submission = await _unitOfWork.ClassroomSubmissions.GetForStudentAsync(
            assignment.ClassroomAssignmentId, request.UserId, cancellationToken);

        if (submission == null)
        {
            submission = new ClassroomSubmission
            {
                ClassroomSubmissionId = Guid.NewGuid(),
                ClassroomAssignmentId = assignment.ClassroomAssignmentId,
                StudentUserId = request.UserId,
                Text = request.Text,
                SubmittedAt = request.Submit ? now : null,
                CreatedAt = now,
                UpdatedAt = now
            };
            await _unitOfWork.ClassroomSubmissions.AddAsync(submission, cancellationToken);
        }
        else
        {
            // Editing after a grade is released would leave feedback attached to text that no longer
            // exists. The instructor has to clear the grade first.
            if (submission.GradedAt != null)
                return Result<ClassroomSubmissionDto>.Failure(
                    "This submission has been graded and can no longer be edited.", "ALREADY_GRADED");

            submission.Text = request.Text;
            if (request.Submit) submission.SubmittedAt = now;
            submission.UpdatedAt = now;
            _unitOfWork.ClassroomSubmissions.Update(submission);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ClassroomSubmissionDto>.Success(
            AssignmentMapping.ToDto(submission, string.Empty, assignment.DueAt),
            request.Submit
                ? isLate ? "Handed in late." : "Handed in."
                : "Draft saved.");
    }
}

// ── Grading command (instructor or assistant) ───────────────────────────────

public record GradeClassroomSubmissionCommand(
    Guid UserId,
    Guid ClassroomId,
    Guid ClassroomAssignmentId,
    Guid StudentUserId,
    double? PointsAwarded,
    string? Feedback) : IRequest<Result<ClassroomSubmissionDto>>;

public class GradeClassroomSubmissionCommandValidator : AbstractValidator<GradeClassroomSubmissionCommand>
{
    public GradeClassroomSubmissionCommandValidator()
    {
        RuleFor(x => x.Feedback).MaximumLength(20000);
        RuleFor(x => x.PointsAwarded).GreaterThanOrEqualTo(0)
            .When(x => x.PointsAwarded.HasValue);
    }
}

public class GradeClassroomSubmissionCommandHandler
    : IRequestHandler<GradeClassroomSubmissionCommand, Result<ClassroomSubmissionDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPushNotificationService _push;

    public GradeClassroomSubmissionCommandHandler(IUnitOfWork unitOfWork, IPushNotificationService push)
    {
        _unitOfWork = unitOfWork;
        _push = push;
    }

    public async Task<Result<ClassroomSubmissionDto>> Handle(
        GradeClassroomSubmissionCommand request, CancellationToken cancellationToken)
    {
        var guard = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: false, cancellationToken);
        if (!guard.IsSuccess)
            return Result<ClassroomSubmissionDto>.Failure(guard.Message, guard.ErrorCode);

        if (!ClassroomRoles.CanGrade(guard.Data!))
            return Result<ClassroomSubmissionDto>.Failure("Instructor access required.", "FORBIDDEN");

        var assignment = await _unitOfWork.ClassroomAssignments
            .GetByIdAsync(request.ClassroomAssignmentId, cancellationToken);
        if (assignment == null || assignment.ClassroomId != request.ClassroomId)
            return Result<ClassroomSubmissionDto>.Failure("Assignment not found.", "NOT_FOUND");

        if (request.PointsAwarded > assignment.PointsPossible)
            return Result<ClassroomSubmissionDto>.Failure(
                $"Score cannot exceed the {assignment.PointsPossible:0.##} points available.", "SCORE_TOO_HIGH");

        var submission = await _unitOfWork.ClassroomSubmissions.GetForStudentAsync(
            assignment.ClassroomAssignmentId, request.StudentUserId, cancellationToken);

        // Nothing handed in is nothing to grade — a draft included, since staff cannot read one.
        if (submission == null || submission.SubmittedAt == null)
            return Result<ClassroomSubmissionDto>.Failure("That student has not submitted yet.", "NOT_FOUND");

        var now = DateTime.UtcNow;
        submission.PointsAwarded = request.PointsAwarded;
        submission.Feedback = request.Feedback?.Trim();
        submission.GradedByUserId = request.UserId;
        // Clearing the score returns the work ungraded, which is how a student gets to edit again.
        submission.GradedAt = request.PointsAwarded.HasValue ? now : null;
        submission.UpdatedAt = now;

        _unitOfWork.ClassroomSubmissions.Update(submission);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var student = await _unitOfWork.Users.GetByIdAsync(request.StudentUserId, cancellationToken);

        // Only a released grade is worth a notification — clearing one hands the work back for editing,
        // which the student will see when they next open it and does not need to interrupt them.
        if (request.PointsAwarded.HasValue)
        {
            var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
            if (classroom != null)
                await ClassroomNotifier.GradeReleasedAsync(
                    _push, classroom, assignment, request.StudentUserId,
                    request.PointsAwarded.Value, cancellationToken);
        }

        return Result<ClassroomSubmissionDto>.Success(
            AssignmentMapping.ToDto(submission, student?.FullName ?? string.Empty, assignment.DueAt),
            request.PointsAwarded.HasValue ? "Grade released." : "Grade cleared.");
    }
}

// ── Guards ──────────────────────────────────────────────────────────────────

internal static class AssignmentGuards
{
    /// <summary>
    /// Confirms an optional linked course is actually assigned to this classroom, returning its name.
    /// Without this an instructor could attach a course the class has no access to, and every student
    /// would get a dead link.
    /// </summary>
    public static async Task<Result<string?>> ResolveCourseAsync(
        IUnitOfWork unitOfWork, Guid classroomId, Guid? courseId, CancellationToken cancellationToken)
    {
        if (courseId == null) return Result<string?>.Success(null);

        var link = await unitOfWork.ClassroomCourses.FirstOrDefaultAsync(
            cc => cc.ClassroomId == classroomId && cc.CourseId == courseId, cancellationToken);

        if (link == null)
            return Result<string?>.Failure("That course is not assigned to this classroom.", "COURSE_NOT_ASSIGNED");

        var course = await unitOfWork.Courses.GetByIdAsync(courseId.Value, cancellationToken);
        return Result<string?>.Success(course?.CourseName);
    }
}
