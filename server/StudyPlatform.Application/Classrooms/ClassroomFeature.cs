using FluentValidation;
using MediatR;
using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record ClassroomDto(
    Guid ClassroomId,
    Guid OrganizationId,
    string OrganizationName,
    string Name,
    string? Description,
    string MyRole,
    string? JoinCode,
    int StudentCount,
    int CourseCount,
    bool IsArchived,
    DateTime CreatedAt,
    bool EnrollmentOpen);

public record ClassroomRosterEntryDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    DateTime EnrolledAt);

public record ClassroomCourseDto(
    Guid ClassroomCourseId,
    Guid CourseId,
    string CourseName,
    DateTime AssignedAt,
    DateTime? DueAt);

public record ClassroomDetailDto(
    Guid ClassroomId,
    Guid OrganizationId,
    string Name,
    string? Description,
    string MyRole,
    string? JoinCode,
    bool IsArchived,
    DateTime CreatedAt,
    IEnumerable<ClassroomRosterEntryDto> Roster,
    IEnumerable<ClassroomCourseDto> Courses,
    bool EnrollmentOpen);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetMyClassroomsQuery(Guid UserId) : IRequest<Result<IEnumerable<ClassroomDto>>>;

public class GetMyClassroomsQueryHandler
    : IRequestHandler<GetMyClassroomsQuery, Result<IEnumerable<ClassroomDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetMyClassroomsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<ClassroomDto>>> Handle(
        GetMyClassroomsQuery request, CancellationToken cancellationToken)
    {
        var classrooms = (await _unitOfWork.Classrooms.GetByUserAsync(request.UserId, cancellationToken)).ToList();

        var orgIds = classrooms.Select(c => c.OrganizationId).Distinct().ToList();
        var orgs = (await _unitOfWork.Organizations.FindAsNoTrackingAsync(
                o => orgIds.Contains(o.OrganizationId), cancellationToken))
            .ToDictionary(o => o.OrganizationId, o => o.Name);

        var dtos = classrooms.Select(c =>
        {
            var myRole = c.Enrollments.First(e => e.UserId == request.UserId && e.RemovedAt == null).Role;
            return ToDto(c, myRole, orgs.GetValueOrDefault(c.OrganizationId, string.Empty));
        });

        return Result<IEnumerable<ClassroomDto>>.Success(dtos);
    }

    internal static ClassroomDto ToDto(Classroom c, string myRole, string organizationName) => new(
        c.ClassroomId,
        c.OrganizationId,
        organizationName,
        c.Name,
        c.Description,
        myRole,
        // The join code is a bearer credential for the roster — students never need it, so it is
        // withheld from anyone who cannot manage the classroom.
        ClassroomRoles.CanManage(myRole) ? c.JoinCode : null,
        c.Enrollments.Count(e => e.RemovedAt == null && e.Role == ClassroomRoles.Student),
        c.Courses.Count,
        c.ArchivedAt != null,
        c.CreatedAt,
        c.EnrollmentOpen);
}

public record GetClassroomDetailQuery(Guid UserId, Guid ClassroomId) : IRequest<Result<ClassroomDetailDto>>;

public class GetClassroomDetailQueryHandler
    : IRequestHandler<GetClassroomDetailQuery, Result<ClassroomDetailDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetClassroomDetailQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomDetailDto>> Handle(
        GetClassroomDetailQuery request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireMemberAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomDetailDto>.Failure(access.Message, access.ErrorCode);

        var classroom = await _unitOfWork.Classrooms.GetWithRosterAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<ClassroomDetailDto>.Failure("Classroom not found.", "NOT_FOUND");

        var myRole = access.Data!;
        var canSeeRoster = ClassroomRoles.CanGrade(myRole);

        // A student sees the teaching staff and themselves, never their classmates' email addresses.
        var roster = canSeeRoster
            ? classroom.Enrollments
            : classroom.Enrollments.Where(e =>
                e.UserId == request.UserId || ClassroomRoles.CanGrade(e.Role));

        var dto = new ClassroomDetailDto(
            classroom.ClassroomId,
            classroom.OrganizationId,
            classroom.Name,
            classroom.Description,
            myRole,
            ClassroomRoles.CanManage(myRole) ? classroom.JoinCode : null,
            classroom.ArchivedAt != null,
            classroom.CreatedAt,
            roster.Select(e => new ClassroomRosterEntryDto(
                e.UserId, e.User.FullName, e.User.Email, e.Role, e.EnrolledAt)),
            classroom.Courses.Select(cc => new ClassroomCourseDto(
                cc.ClassroomCourseId, cc.CourseId, cc.Course.CourseName, cc.AssignedAt, cc.DueAt)),
            classroom.EnrollmentOpen);

        return Result<ClassroomDetailDto>.Success(dto);
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

public record CreateClassroomCommand(Guid UserId, Guid OrganizationId, string Name, string? Description)
    : IRequest<Result<ClassroomDto>>;

public class CreateClassroomCommandValidator : AbstractValidator<CreateClassroomCommand>
{
    public CreateClassroomCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public class CreateClassroomCommandHandler : IRequestHandler<CreateClassroomCommand, Result<ClassroomDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEntitlementService _entitlements;

    public CreateClassroomCommandHandler(IUnitOfWork unitOfWork, IEntitlementService entitlements)
    {
        _unitOfWork = unitOfWork;
        _entitlements = entitlements;
    }

    public async Task<Result<ClassroomDto>> Handle(
        CreateClassroomCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireOrganizationRoleAsync(
            _unitOfWork, request.OrganizationId, request.UserId,
            OrganizationRoles.CanTeach, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomDto>.Failure(access.Message, access.ErrorCode);

        var quota = await ClassroomAccess.RequireClassroomQuotaAsync(
            _unitOfWork, _entitlements, request.OrganizationId, request.UserId, cancellationToken);
        if (!quota.IsSuccess)
            return Result<ClassroomDto>.Failure(quota.Message, quota.ErrorCode);

        var org = await _unitOfWork.Organizations.GetByIdAsync(request.OrganizationId, cancellationToken);
        if (org == null)
            return Result<ClassroomDto>.Failure("Organization not found.", "NOT_FOUND");

        var now = DateTime.UtcNow;

        string joinCode;
        var attempts = 0;
        do
        {
            joinCode = ClassroomAccess.GenerateCode();
            attempts++;
        }
        while (await _unitOfWork.Classrooms.GetByJoinCodeAsync(joinCode, cancellationToken) != null && attempts < 5);

        var classroom = new Classroom
        {
            ClassroomId = Guid.NewGuid(),
            OrganizationId = request.OrganizationId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            JoinCode = joinCode,
            CreatedByUserId = request.UserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _unitOfWork.Classrooms.AddAsync(classroom, cancellationToken);

        var enrollment = new ClassroomEnrollment
        {
            ClassroomEnrollmentId = Guid.NewGuid(),
            ClassroomId = classroom.ClassroomId,
            UserId = request.UserId,
            Role = ClassroomRoles.Instructor,
            EnrolledAt = now
        };
        await _unitOfWork.ClassroomEnrollments.AddAsync(enrollment, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        classroom.Enrollments.Add(enrollment);
        return Result<ClassroomDto>.Success(
            GetMyClassroomsQueryHandler.ToDto(classroom, ClassroomRoles.Instructor, org.Name),
            "Classroom created.");
    }
}

public record JoinClassroomCommand(Guid UserId, string JoinCode) : IRequest<Result<ClassroomDto>>;

public class JoinClassroomCommandHandler : IRequestHandler<JoinClassroomCommand, Result<ClassroomDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEntitlementService _entitlements;

    public JoinClassroomCommandHandler(IUnitOfWork unitOfWork, IEntitlementService entitlements)
    {
        _unitOfWork = unitOfWork;
        _entitlements = entitlements;
    }

    public async Task<Result<ClassroomDto>> Handle(
        JoinClassroomCommand request, CancellationToken cancellationToken)
    {
        var code = request.JoinCode.Trim().ToUpperInvariant();
        var classroom = await _unitOfWork.Classrooms.GetByJoinCodeAsync(code, cancellationToken);
        if (classroom == null)
            return Result<ClassroomDto>.Failure("That join code is not valid.", "NOT_FOUND");

        if (classroom.ArchivedAt != null)
            return Result<ClassroomDto>.Failure("That classroom has been archived.", "CLASSROOM_ARCHIVED");

        if (!classroom.EnrollmentOpen)
            return Result<ClassroomDto>.Failure(
                "This classroom is not accepting new students.", "ENROLLMENT_CLOSED");

        var existing = await _unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(classroom.ClassroomId, request.UserId, cancellationToken);
        if (existing != null)
            return Result<ClassroomDto>.Failure("You are already enrolled in this classroom.", "ALREADY_ENROLLED");

        // Checked after the already-enrolled case so a full classroom still lets its own students back
        // to their work rather than telling them the class is full.
        var seat = await ClassroomAccess.RequireClassroomSeatAsync(
            _unitOfWork, _entitlements, classroom, cancellationToken);
        if (!seat.IsSuccess)
            return Result<ClassroomDto>.Failure(seat.Message, seat.ErrorCode);

        var now = DateTime.UtcNow;
        var enrollment = new ClassroomEnrollment
        {
            ClassroomEnrollmentId = Guid.NewGuid(),
            ClassroomId = classroom.ClassroomId,
            UserId = request.UserId,
            Role = ClassroomRoles.Student,
            EnrolledAt = now
        };
        await _unitOfWork.ClassroomEnrollments.AddAsync(enrollment, cancellationToken);

        // Enrolling in a classroom implies membership of its organization at the lowest role, so the
        // student can resolve the org name without a second, unauthorized lookup.
        var orgMembership = await _unitOfWork.OrganizationMembers
            .GetMembershipAsync(classroom.OrganizationId, request.UserId, cancellationToken);
        if (orgMembership == null)
        {
            await _unitOfWork.OrganizationMembers.AddAsync(new OrganizationMember
            {
                OrganizationMemberId = Guid.NewGuid(),
                OrganizationId = classroom.OrganizationId,
                UserId = request.UserId,
                Role = OrganizationRoles.Member,
                JoinedAt = now
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var org = await _unitOfWork.Organizations.GetByIdAsync(classroom.OrganizationId, cancellationToken);
        classroom.Enrollments.Add(enrollment);

        return Result<ClassroomDto>.Success(
            GetMyClassroomsQueryHandler.ToDto(classroom, ClassroomRoles.Student, org?.Name ?? string.Empty),
            "Enrolled.");
    }
}

/// <summary>
/// Enrolls someone directly, by email, without them entering a code.
///
/// The join code is fine for a room full of students typing it in, but an institution adding a named
/// cohort should not have to distribute a bearer credential to do it. Mirrors the organization invite:
/// the account must already exist, and inviting someone already enrolled re-roles them instead of
/// failing.
/// </summary>
public record AddClassroomMemberCommand(Guid UserId, Guid ClassroomId, string Email, string Role)
    : IRequest<Result<ClassroomRosterEntryDto>>;

public class AddClassroomMemberCommandValidator : AbstractValidator<AddClassroomMemberCommand>
{
    public AddClassroomMemberCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Role).Must(r => ClassroomRoles.All.Contains(r))
            .WithMessage("Role must be one of: instructor, assistant, student.");
    }
}

public class AddClassroomMemberCommandHandler
    : IRequestHandler<AddClassroomMemberCommand, Result<ClassroomRosterEntryDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEntitlementService _entitlements;

    public AddClassroomMemberCommandHandler(IUnitOfWork unitOfWork, IEntitlementService entitlements)
    {
        _unitOfWork = unitOfWork;
        _entitlements = entitlements;
    }

    public async Task<Result<ClassroomRosterEntryDto>> Handle(
        AddClassroomMemberCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomRosterEntryDto>.Failure(access.Message, access.ErrorCode);

        var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<ClassroomRosterEntryDto>.Failure("Classroom not found.", "NOT_FOUND");

        var invitee = await _unitOfWork.Users.FirstOrDefaultAsync(
            u => u.Email == request.Email.Trim().ToLower(), cancellationToken);
        if (invitee == null)
            return Result<ClassroomRosterEntryDto>.Failure("No account exists for that email.", "USER_NOT_FOUND");

        var existing = await _unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(request.ClassroomId, invitee.UserId, cancellationToken);

        if (existing != null)
        {
            existing.Role = request.Role;
            _unitOfWork.ClassroomEnrollments.Update(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Result<ClassroomRosterEntryDto>.Success(
                new ClassroomRosterEntryDto(
                    invitee.UserId, invitee.FullName, invitee.Email, existing.Role, existing.EnrolledAt),
                "Role updated.");
        }

        // A previously removed enrollment is reactivated rather than duplicated. Enrollments are
        // deliberately non-unique per (classroom, user) so history survives, but reviving the most
        // recent row is what an instructor undoing an accidental removal actually means — and it
        // brings their old grades back into the gradebook with them, which a fresh row would not.
        var removed = (await _unitOfWork.ClassroomEnrollments.FindAsync(
                e => e.ClassroomId == request.ClassroomId && e.UserId == invitee.UserId,
                cancellationToken))
            .OrderByDescending(e => e.EnrolledAt)
            .FirstOrDefault();

        if (removed != null)
        {
            var seatForRestore = await ClassroomAccess.RequireClassroomSeatAsync(
                _unitOfWork, _entitlements, classroom, cancellationToken);
            if (!seatForRestore.IsSuccess)
                return Result<ClassroomRosterEntryDto>.Failure(seatForRestore.Message, seatForRestore.ErrorCode);

            removed.RemovedAt = null;
            removed.Role = request.Role;
            _unitOfWork.ClassroomEnrollments.Update(removed);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Result<ClassroomRosterEntryDto>.Success(
                new ClassroomRosterEntryDto(
                    invitee.UserId, invitee.FullName, invitee.Email, removed.Role, removed.EnrolledAt),
                "Student restored to the roster.");
        }

        // Seats are only spent by students; adding a co-instructor is not capacity.
        if (request.Role == ClassroomRoles.Student)
        {
            var seat = await ClassroomAccess.RequireClassroomSeatAsync(
                _unitOfWork, _entitlements, classroom, cancellationToken);
            if (!seat.IsSuccess)
                return Result<ClassroomRosterEntryDto>.Failure(seat.Message, seat.ErrorCode);
        }

        var now = DateTime.UtcNow;
        var enrollment = new ClassroomEnrollment
        {
            ClassroomEnrollmentId = Guid.NewGuid(),
            ClassroomId = request.ClassroomId,
            UserId = invitee.UserId,
            Role = request.Role,
            EnrolledAt = now
        };
        await _unitOfWork.ClassroomEnrollments.AddAsync(enrollment, cancellationToken);

        // Same implied org membership the join-code path grants, so the added user can resolve the
        // organization name without a second, unauthorized lookup.
        var orgMembership = await _unitOfWork.OrganizationMembers
            .GetMembershipAsync(classroom.OrganizationId, invitee.UserId, cancellationToken);
        if (orgMembership == null)
        {
            await _unitOfWork.OrganizationMembers.AddAsync(new OrganizationMember
            {
                OrganizationMemberId = Guid.NewGuid(),
                OrganizationId = classroom.OrganizationId,
                UserId = invitee.UserId,
                Role = OrganizationRoles.Member,
                JoinedAt = now
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ClassroomRosterEntryDto>.Success(
            new ClassroomRosterEntryDto(
                invitee.UserId, invitee.FullName, invitee.Email, enrollment.Role, enrollment.EnrolledAt),
            "Added to the classroom.");
    }
}

public record SetEnrollmentRoleCommand(Guid UserId, Guid ClassroomId, Guid TargetUserId, string Role)
    : IRequest<Result<bool>>;

public class SetEnrollmentRoleCommandValidator : AbstractValidator<SetEnrollmentRoleCommand>
{
    public SetEnrollmentRoleCommandValidator()
    {
        RuleFor(x => x.Role).Must(r => ClassroomRoles.All.Contains(r))
            .WithMessage("Role must be one of: instructor, assistant, student.");
    }
}

public class SetEnrollmentRoleCommandHandler : IRequestHandler<SetEnrollmentRoleCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SetEnrollmentRoleCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(SetEnrollmentRoleCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var enrollment = await _unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(request.ClassroomId, request.TargetUserId, cancellationToken);
        if (enrollment == null)
            return Result<bool>.Failure("That user is not enrolled.", "NOT_FOUND");

        // Refuse to demote the last instructor — the classroom would become unmanageable.
        if (enrollment.Role == ClassroomRoles.Instructor && request.Role != ClassroomRoles.Instructor)
        {
            var instructorCount = await _unitOfWork.ClassroomEnrollments.CountAsync(
                e => e.ClassroomId == request.ClassroomId
                     && e.RemovedAt == null
                     && e.Role == ClassroomRoles.Instructor,
                cancellationToken);

            if (instructorCount <= 1)
                return Result<bool>.Failure("A classroom must keep at least one instructor.", "LAST_INSTRUCTOR");
        }

        enrollment.Role = request.Role;
        _unitOfWork.ClassroomEnrollments.Update(enrollment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Role updated.");
    }
}

public record RemoveEnrollmentCommand(Guid UserId, Guid ClassroomId, Guid TargetUserId) : IRequest<Result<bool>>;

public class RemoveEnrollmentCommandHandler : IRequestHandler<RemoveEnrollmentCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public RemoveEnrollmentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(RemoveEnrollmentCommand request, CancellationToken cancellationToken)
    {
        // A student may always remove themselves; removing anyone else needs manage rights. Either way
        // the classroom must still be live — a soft-removed enrollment drops out of the gradebook, so
        // leaving an archived class would rewrite a finished record.
        var isSelf = request.TargetUserId == request.UserId;
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: !isSelf, cancellationToken);

        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var enrollment = await _unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(request.ClassroomId, request.TargetUserId, cancellationToken);
        if (enrollment == null)
            return Result<bool>.Failure("That user is not enrolled.", "NOT_FOUND");

        if (enrollment.Role == ClassroomRoles.Instructor)
        {
            var instructorCount = await _unitOfWork.ClassroomEnrollments.CountAsync(
                e => e.ClassroomId == request.ClassroomId
                     && e.RemovedAt == null
                     && e.Role == ClassroomRoles.Instructor,
                cancellationToken);

            if (instructorCount <= 1)
                return Result<bool>.Failure("A classroom must keep at least one instructor.", "LAST_INSTRUCTOR");
        }

        // Soft-remove: the gradebook still needs to attribute past submissions to this person.
        enrollment.RemovedAt = DateTime.UtcNow;
        _unitOfWork.ClassroomEnrollments.Update(enrollment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, isSelf ? "You have left the classroom." : "Student removed.");
    }
}

public record AssignCourseToClassroomCommand(Guid UserId, Guid ClassroomId, Guid CourseId, DateTime? DueAt)
    : IRequest<Result<ClassroomCourseDto>>;

public class AssignCourseToClassroomCommandHandler
    : IRequestHandler<AssignCourseToClassroomCommand, Result<ClassroomCourseDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public AssignCourseToClassroomCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomCourseDto>> Handle(
        AssignCourseToClassroomCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomCourseDto>.Failure(access.Message, access.ErrorCode);

        // The instructor can only assign a course they own — this is the one place a classroom
        // reaches into the per-user library, so the ownership check is explicit.
        var course = await _unitOfWork.Courses.FirstOrDefaultAsync(
            c => c.CourseId == request.CourseId && c.UserId == request.UserId, cancellationToken);
        if (course == null)
            return Result<ClassroomCourseDto>.Failure("Course not found in your library.", "NOT_FOUND");

        var existing = await _unitOfWork.ClassroomCourses.FirstOrDefaultAsync(
            cc => cc.ClassroomId == request.ClassroomId && cc.CourseId == request.CourseId, cancellationToken);
        if (existing != null)
        {
            existing.DueAt = request.DueAt;
            _unitOfWork.ClassroomCourses.Update(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Result<ClassroomCourseDto>.Success(
                new ClassroomCourseDto(existing.ClassroomCourseId, course.CourseId, course.CourseName,
                    existing.AssignedAt, existing.DueAt),
                "Due date updated.");
        }

        var assignment = new ClassroomCourse
        {
            ClassroomCourseId = Guid.NewGuid(),
            ClassroomId = request.ClassroomId,
            CourseId = request.CourseId,
            AssignedByUserId = request.UserId,
            AssignedAt = DateTime.UtcNow,
            DueAt = request.DueAt
        };
        await _unitOfWork.ClassroomCourses.AddAsync(assignment, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ClassroomCourseDto>.Success(
            new ClassroomCourseDto(assignment.ClassroomCourseId, course.CourseId, course.CourseName,
                assignment.AssignedAt, assignment.DueAt),
            "Course assigned.");
    }
}

public record UnassignCourseCommand(Guid UserId, Guid ClassroomId, Guid ClassroomCourseId) : IRequest<Result<bool>>;

public class UnassignCourseCommandHandler : IRequestHandler<UnassignCourseCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UnassignCourseCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(UnassignCourseCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var assignment = await _unitOfWork.ClassroomCourses.FirstOrDefaultAsync(
            cc => cc.ClassroomCourseId == request.ClassroomCourseId && cc.ClassroomId == request.ClassroomId,
            cancellationToken);
        if (assignment == null)
            return Result<bool>.Failure("Assignment not found.", "NOT_FOUND");

        _unitOfWork.ClassroomCourses.Remove(assignment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Course unassigned.");
    }
}

/// <summary>
/// Issues a new join code, invalidating the old one. Manager-only, and refused on an archived
/// classroom like every other write.
/// </summary>
public record RotateJoinCodeCommand(Guid UserId, Guid ClassroomId) : IRequest<Result<string>>;

public class RotateJoinCodeCommandHandler : IRequestHandler<RotateJoinCodeCommand, Result<string>>
{
    private readonly IUnitOfWork _unitOfWork;
    public RotateJoinCodeCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<string>> Handle(RotateJoinCodeCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<string>.Failure(access.Message, access.ErrorCode);

        var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<string>.Failure("Classroom not found.", "NOT_FOUND");

        // Same collision retry as creation — the code is unique platform-wide, so a clash would
        // otherwise hand this classroom's students to someone else's roster.
        string joinCode;
        var attempts = 0;
        do
        {
            joinCode = ClassroomAccess.GenerateCode();
            attempts++;
        }
        while (await _unitOfWork.Classrooms.GetByJoinCodeAsync(joinCode, cancellationToken) != null && attempts < 5);

        classroom.JoinCode = joinCode;
        classroom.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Classrooms.Update(classroom);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Nobody already enrolled is affected: the code only ever gates joining.
        return Result<string>.Success(joinCode, "New join code issued. The old one no longer works.");
    }
}

/// <summary>Opens or closes self-enrollment without changing the code itself.</summary>
public record SetEnrollmentOpenCommand(Guid UserId, Guid ClassroomId, bool Open) : IRequest<Result<bool>>;

public class SetEnrollmentOpenCommandHandler : IRequestHandler<SetEnrollmentOpenCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SetEnrollmentOpenCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(SetEnrollmentOpenCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireWritableAsync(
            _unitOfWork, request.ClassroomId, request.UserId, manager: true, cancellationToken);
        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<bool>.Failure("Classroom not found.", "NOT_FOUND");

        classroom.EnrollmentOpen = request.Open;
        classroom.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Classrooms.Update(classroom);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, request.Open ? "Enrollment reopened." : "Enrollment closed.");
    }
}

public record ArchiveClassroomCommand(Guid UserId, Guid ClassroomId, bool Archived) : IRequest<Result<bool>>;

public class ArchiveClassroomCommandHandler : IRequestHandler<ArchiveClassroomCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public ArchiveClassroomCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(ArchiveClassroomCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireManagerAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var classroom = await _unitOfWork.Classrooms.GetByIdAsync(request.ClassroomId, cancellationToken);
        if (classroom == null)
            return Result<bool>.Failure("Classroom not found.", "NOT_FOUND");

        classroom.ArchivedAt = request.Archived ? DateTime.UtcNow : null;
        classroom.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Classrooms.Update(classroom);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, request.Archived ? "Classroom archived." : "Classroom restored.");
    }
}
