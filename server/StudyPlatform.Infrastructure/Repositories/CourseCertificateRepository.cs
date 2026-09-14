using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class CourseCertificateRepository : Repository<CourseCertificate>, ICourseCertificateRepository
{
    public CourseCertificateRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<CourseCertificate>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.IssuedAt)
            .ToListAsync(cancellationToken);

    public async Task<CourseCertificate?> GetForCourseAsync(
        Guid userId, Guid courseId, CancellationToken cancellationToken = default)
        // Revoked ones are excluded so withdrawing a certificate lets the user earn it again.
        => await _dbSet.FirstOrDefaultAsync(
            c => c.UserId == userId && c.CourseId == courseId && c.RevokedAt == null,
            cancellationToken);

    public async Task<CourseCertificate?> GetByTokenAsync(
        string token, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicToken == token, cancellationToken);
}
