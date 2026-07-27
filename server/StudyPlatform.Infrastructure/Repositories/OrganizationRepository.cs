using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class OrganizationRepository : Repository<Organization>, IOrganizationRepository
{
    public OrganizationRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Organization>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(o => o.Members)
            .Where(o => o.Members.Any(m => m.UserId == userId))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<Organization?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(o => o.Slug == slug, cancellationToken);

    public async Task<Organization?> GetWithMembersAsync(Guid organizationId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(o => o.Members).ThenInclude(m => m.User)
            .Include(o => o.Classrooms)
            .FirstOrDefaultAsync(o => o.OrganizationId == organizationId, cancellationToken);
}

public class OrganizationMemberRepository : Repository<OrganizationMember>, IOrganizationMemberRepository
{
    public OrganizationMemberRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<OrganizationMember>> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(m => m.User)
            .Where(m => m.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

    public async Task<OrganizationMember?> GetMembershipAsync(Guid organizationId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(
            m => m.OrganizationId == organizationId && m.UserId == userId, cancellationToken);
}

public class ClassroomRepository : Repository<Classroom>, IClassroomRepository
{
    public ClassroomRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Classroom>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Enrollments)
            .Include(c => c.Courses)
            .Where(c => c.Enrollments.Any(e => e.UserId == userId && e.RemovedAt == null))
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<Classroom>> GetByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Enrollments)
            .Include(c => c.Courses)
            .Where(c => c.OrganizationId == organizationId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<Classroom?> GetByJoinCodeAsync(string joinCode, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.JoinCode == joinCode, cancellationToken);

    public async Task<Classroom?> GetWithRosterAsync(Guid classroomId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(c => c.Organization)
            .Include(c => c.Enrollments.Where(e => e.RemovedAt == null)).ThenInclude(e => e.User)
            .Include(c => c.Courses).ThenInclude(cc => cc.Course)
            .FirstOrDefaultAsync(c => c.ClassroomId == classroomId, cancellationToken);
}

public class ClassroomEnrollmentRepository : Repository<ClassroomEnrollment>, IClassroomEnrollmentRepository
{
    public ClassroomEnrollmentRepository(AppDbContext context) : base(context) { }

    public async Task<ClassroomEnrollment?> GetActiveEnrollmentAsync(Guid classroomId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(
            e => e.ClassroomId == classroomId && e.UserId == userId && e.RemovedAt == null, cancellationToken);
}

public class ClassroomCourseRepository : Repository<ClassroomCourse>, IClassroomCourseRepository
{
    public ClassroomCourseRepository(AppDbContext context) : base(context) { }
}
