using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IOrganizationRepository : IRepository<Organization>
{
    Task<IEnumerable<Organization>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Organization?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<Organization?> GetWithMembersAsync(Guid organizationId, CancellationToken cancellationToken = default);
}

public interface IOrganizationMemberRepository : IRepository<OrganizationMember>
{
    Task<IEnumerable<OrganizationMember>> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
    Task<OrganizationMember?> GetMembershipAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken = default);
}

public interface IClassroomRepository : IRepository<Classroom>
{
    /// <summary>Classrooms the user is enrolled in (any role), newest first. Excludes removed enrollments.</summary>
    Task<IEnumerable<Classroom>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<IEnumerable<Classroom>> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
    Task<Classroom?> GetByJoinCodeAsync(string joinCode, CancellationToken cancellationToken = default);

    /// <summary>Full classroom graph: active enrollments with their users, plus assigned courses.</summary>
    Task<Classroom?> GetWithRosterAsync(Guid classroomId, CancellationToken cancellationToken = default);
}

public interface IClassroomEnrollmentRepository : IRepository<ClassroomEnrollment>
{
    Task<ClassroomEnrollment?> GetActiveEnrollmentAsync(Guid classroomId, Guid userId, CancellationToken cancellationToken = default);
}

public interface IClassroomCourseRepository : IRepository<ClassroomCourse>
{
}

public interface IClassroomAssignmentRepository : IRepository<ClassroomAssignment>
{
    /// <summary>
    /// Assignments for a classroom, newest due first. Drafts are included — filtering them out is the
    /// handler's job, because it is the only layer that knows the caller's role.
    /// </summary>
    Task<IEnumerable<ClassroomAssignment>> GetByClassroomAsync(Guid classroomId, CancellationToken cancellationToken = default);

    /// <summary>An assignment with every submission and its author. Grader-only reads.</summary>
    Task<ClassroomAssignment?> GetWithSubmissionsAsync(Guid classroomAssignmentId, CancellationToken cancellationToken = default);
}

public interface IClassroomSubmissionRepository : IRepository<ClassroomSubmission>
{
    Task<ClassroomSubmission?> GetForStudentAsync(Guid classroomAssignmentId, Guid studentUserId, CancellationToken cancellationToken = default);

    /// <summary>Every submission the given student has across a set of assignments — the student's own list view.</summary>
    Task<IEnumerable<ClassroomSubmission>> GetForStudentAcrossAsync(IEnumerable<Guid> classroomAssignmentIds, Guid studentUserId, CancellationToken cancellationToken = default);
}
