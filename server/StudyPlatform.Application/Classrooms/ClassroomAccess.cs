using StudyPlatform.Application.Billing;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

/// <summary>
/// The single place classroom authorization is decided.
///
/// Every other feature in the codebase scopes by "row.UserId == jwtUserId" and is done. Classrooms
/// are the exception — an instructor legitimately reads rows belonging to other users — so the check
/// is centralized here rather than re-derived per handler, where one missing clause would silently
/// leak a roster.
/// </summary>
public static class ClassroomAccess
{
    /// <summary>
    /// Resolves the caller's active role in a classroom, or a failure Result if they have none.
    /// The out-parameter carries the role so callers can further narrow (grade vs. manage).
    /// </summary>
    public static async Task<Result<string>> RequireMemberAsync(
        IUnitOfWork unitOfWork, Guid classroomId, Guid userId, CancellationToken cancellationToken)
    {
        var classroom = await unitOfWork.Classrooms.GetByIdAsync(classroomId, cancellationToken);
        if (classroom == null)
            return Result<string>.Failure("Classroom not found.", "NOT_FOUND");

        var enrollment = await unitOfWork.ClassroomEnrollments
            .GetActiveEnrollmentAsync(classroomId, userId, cancellationToken);

        if (enrollment != null)
            return Result<string>.Success(enrollment.Role);

        // Organization owners and admins can administer any classroom in their org even when they
        // are not personally enrolled — otherwise nobody could recover a classroom whose only
        // instructor left the institution.
        var orgMembership = await unitOfWork.OrganizationMembers
            .GetMembershipAsync(classroom.OrganizationId, userId, cancellationToken);

        if (orgMembership != null && OrganizationRoles.CanAdminister(orgMembership.Role))
            return Result<string>.Success(ClassroomRoles.Instructor);

        return Result<string>.Failure("Access denied.", "FORBIDDEN");
    }

    /// <summary>Caller must be able to read other students' work (instructor or assistant).</summary>
    public static async Task<Result<string>> RequireGraderAsync(
        IUnitOfWork unitOfWork, Guid classroomId, Guid userId, CancellationToken cancellationToken)
    {
        var role = await RequireMemberAsync(unitOfWork, classroomId, userId, cancellationToken);
        if (!role.IsSuccess) return role;

        return ClassroomRoles.CanGrade(role.Data!)
            ? role
            : Result<string>.Failure("Instructor access required.", "FORBIDDEN");
    }

    /// <summary>Caller must be able to change the roster or assign courses (instructor only).</summary>
    public static async Task<Result<string>> RequireManagerAsync(
        IUnitOfWork unitOfWork, Guid classroomId, Guid userId, CancellationToken cancellationToken)
    {
        var role = await RequireMemberAsync(unitOfWork, classroomId, userId, cancellationToken);
        if (!role.IsSuccess) return role;

        return ClassroomRoles.CanManage(role.Data!)
            ? role
            : Result<string>.Failure("Instructor access required.", "FORBIDDEN");
    }

    /// <summary>
    /// Resolves the caller's role and refuses every write against an archived classroom in one place.
    ///
    /// Archiving means read-only for everyone, including the instructor who archived it — that is what
    /// makes an archived gradebook trustworthy as a record of how the class actually went. Note that it
    /// closes roster changes too: a soft-removed enrollment drops out of the gradebook's rows, so
    /// letting anyone leave an archived class would quietly rewrite its results.
    ///
    /// Un-archiving is the one write that must stay open, so <see cref="ArchiveClassroomCommand"/>
    /// deliberately uses <see cref="RequireManagerAsync"/> instead.
    /// </summary>
    public static async Task<Result<string>> RequireWritableAsync(
        IUnitOfWork unitOfWork, Guid classroomId, Guid userId, bool manager, CancellationToken cancellationToken)
    {
        var access = manager
            ? await RequireManagerAsync(unitOfWork, classroomId, userId, cancellationToken)
            : await RequireMemberAsync(unitOfWork, classroomId, userId, cancellationToken);

        if (!access.IsSuccess) return access;

        var classroom = await unitOfWork.Classrooms.GetByIdAsync(classroomId, cancellationToken);
        if (classroom == null)
            return Result<string>.Failure("Classroom not found.", "NOT_FOUND");

        return classroom.ArchivedAt != null
            ? Result<string>.Failure("This classroom is archived and read-only.", "CLASSROOM_ARCHIVED")
            : access;
    }

    /// <summary>Caller must hold an organization role that permits the given predicate.</summary>
    public static async Task<Result<string>> RequireOrganizationRoleAsync(
        IUnitOfWork unitOfWork, Guid organizationId, Guid userId,
        Func<string, bool> permitted, CancellationToken cancellationToken)
    {
        var membership = await unitOfWork.OrganizationMembers
            .GetMembershipAsync(organizationId, userId, cancellationToken);

        if (membership == null)
            return Result<string>.Failure("Organization not found.", "NOT_FOUND");

        return permitted(membership.Role)
            ? Result<string>.Success(membership.Role)
            : Result<string>.Failure("Access denied.", "FORBIDDEN");
    }

    /// <summary>
    /// Refuses a new classroom once the creator's plan is out of them.
    ///
    /// Counted per organization and over live classrooms only: the org is what actually holds the
    /// classrooms, an org subscription covers every member equally, and archiving a finished class
    /// should give the seat back rather than making last term's records cost this term's quota.
    /// </summary>
    public static async Task<Result<bool>> RequireClassroomQuotaAsync(
        IUnitOfWork unitOfWork, IEntitlementService entitlements,
        Guid organizationId, Guid userId, CancellationToken cancellationToken)
    {
        var entitlement = await entitlements.GetForUserAsync(userId, cancellationToken);
        var max = entitlement.Plan.MaxClassrooms;
        if (max <= 0) return Result<bool>.Success(true);

        var live = await unitOfWork.Classrooms.CountAsync(
            c => c.OrganizationId == organizationId && c.ArchivedAt == null, cancellationToken);

        return live >= max
            ? Result<bool>.Failure(
                $"The {entitlement.Plan.DisplayName} plan allows {max} active classroom{(max == 1 ? "" : "s")}. " +
                "Archive one or upgrade to add another.",
                "CLASSROOM_LIMIT_REACHED")
            : Result<bool>.Success(true);
    }

    /// <summary>
    /// Refuses an enrollment once the classroom is at its seat limit.
    ///
    /// The limit comes from the plan of whoever created the classroom, not the joining student — a
    /// student on Free joining an institution's class is spending the institution's seats, and their
    /// own plan has nothing to do with how big someone else's class may be. Only active students are
    /// counted, so removing someone frees their seat while their grades stay on record.
    /// </summary>
    public static async Task<Result<bool>> RequireClassroomSeatAsync(
        IUnitOfWork unitOfWork, IEntitlementService entitlements,
        Classroom classroom, CancellationToken cancellationToken)
    {
        var entitlement = await entitlements.GetForUserAsync(classroom.CreatedByUserId, cancellationToken);
        var max = entitlement.Plan.MaxStudentsPerClassroom;
        if (max <= 0) return Result<bool>.Success(true);

        var students = await unitOfWork.ClassroomEnrollments.CountAsync(
            e => e.ClassroomId == classroom.ClassroomId
                 && e.RemovedAt == null
                 && e.Role == ClassroomRoles.Student,
            cancellationToken);

        return students >= max
            ? Result<bool>.Failure(
                $"This classroom is full ({max} students). Ask your instructor to upgrade the plan.",
                "CLASSROOM_FULL")
            : Result<bool>.Success(true);
    }

    /// <summary>
    /// Human-friendly join/invite code. Ambiguous characters (0/O, 1/I) are excluded because these
    /// get read aloud in a classroom.
    /// </summary>
    public static string GenerateCode(int length = 8)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(length);
        return new string(bytes.Select(b => alphabet[b % alphabet.Length]).ToArray());
    }

    /// <summary>URL-safe slug derived from an organization name, with a random suffix for uniqueness.</summary>
    public static string GenerateSlug(string name)
    {
        var basePart = new string(name.ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray())
            .Trim('-');

        while (basePart.Contains("--"))
            basePart = basePart.Replace("--", "-");

        if (basePart.Length > 40) basePart = basePart[..40].Trim('-');
        if (string.IsNullOrEmpty(basePart)) basePart = "org";

        return $"{basePart}-{GenerateCode(6).ToLowerInvariant()}";
    }
}
