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
    /// <summary>Active (not removed) enrollments for a classroom, with User loaded.</summary>
    Task<IEnumerable<ClassroomEnrollment>> GetActiveByClassroomAsync(Guid classroomId, CancellationToken cancellationToken = default);

    Task<ClassroomEnrollment?> GetActiveEnrollmentAsync(Guid classroomId, Guid userId, CancellationToken cancellationToken = default);
}

public interface IClassroomCourseRepository : IRepository<ClassroomCourse>
{
    Task<IEnumerable<ClassroomCourse>> GetByClassroomAsync(Guid classroomId, CancellationToken cancellationToken = default);

    /// <summary>Course assignments visible to a student across every classroom they are enrolled in.</summary>
    Task<IEnumerable<ClassroomCourse>> GetForStudentAsync(Guid userId, CancellationToken cancellationToken = default);
}
