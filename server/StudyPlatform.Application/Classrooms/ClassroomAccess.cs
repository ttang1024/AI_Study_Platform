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
