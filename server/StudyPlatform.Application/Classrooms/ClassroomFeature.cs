using FluentValidation;
using MediatR;
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
    DateTime CreatedAt);

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
    IEnumerable<ClassroomCourseDto> Courses);

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
        c.CreatedAt);
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
                cc.ClassroomCourseId, cc.CourseId, cc.Course.CourseName, cc.AssignedAt, cc.DueAt)));

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
    public CreateClassroomCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomDto>> Handle(
        CreateClassroomCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireOrganizationRoleAsync(
            _unitOfWork, request.OrganizationId, request.UserId,
            OrganizationRoles.CanTeach, cancellationToken);
        if (!access.IsSuccess)
            return Result<ClassroomDto>.Failure(access.Message, access.ErrorCode);

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
    public JoinClassroomCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ClassroomDto>> Handle(
        JoinClassroomCommand request, CancellationToken cancellationToken)
    {
        var code = request.JoinCode.Trim().ToUpperInvariant();
        var classroom = await _unitOfWork.Classrooms.GetByJoinCodeAsync(code, cancellationToken);
        if (classroom == null)
            return Result<ClassroomDto>.Failure("That join code is not valid.", "NOT_FOUND");

        if (classroom.ArchivedAt != null)
            return Result<ClassroomDto>.Failure("That classroom has been archived.", "CLASSROOM_ARCHIVED");

        var existing = await _unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(classroom.ClassroomId, request.UserId, cancellationToken);
        if (existing != null)
            return Result<ClassroomDto>.Failure("You are already enrolled in this classroom.", "ALREADY_ENROLLED");

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
        var access = await ClassroomAccess.RequireManagerAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
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
        // A student may always remove themselves; removing anyone else needs manage rights.
        var isSelf = request.TargetUserId == request.UserId;
        var access = isSelf
            ? await ClassroomAccess.RequireMemberAsync(_unitOfWork, request.ClassroomId, request.UserId, cancellationToken)
            : await ClassroomAccess.RequireManagerAsync(_unitOfWork, request.ClassroomId, request.UserId, cancellationToken);

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
        var access = await ClassroomAccess.RequireManagerAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
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
        var access = await ClassroomAccess.RequireManagerAsync(
            _unitOfWork, request.ClassroomId, request.UserId, cancellationToken);
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
