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

public class EssayPeerReviewRepository : Repository<EssayPeerReview>, IEssayPeerReviewRepository
{
    public EssayPeerReviewRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<EssayPeerReview>> GetForSubmissionAsync(
        Guid essaySubmissionId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(r => r.EssaySubmissionId == essaySubmissionId)
            .OrderBy(r => r.AssignedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<EssayPeerReview>> GetAssignedToReviewerAsync(
        Guid reviewerUserId, bool includeSubmitted, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(r => r.Submission)
            .Where(r => r.ReviewerUserId == reviewerUserId && r.Status != EssayPeerReviewStatus.Cancelled);

        if (!includeSubmitted)
            query = query.Where(r => r.Status == EssayPeerReviewStatus.Assigned);

        return await query
            // Oldest assignment first: the queue is work to get through, and the draft that has been
            // waiting longest is the one whose author is most stuck.
            .OrderBy(r => r.AssignedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<EssayPeerReview?> GetWithSubmissionAsync(
        Guid essayPeerReviewId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(r => r.Submission)
            .FirstOrDefaultAsync(r => r.EssayPeerReviewId == essayPeerReviewId, cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetExistingReviewerIdsAsync(
        Guid essaySubmissionId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(r => r.EssaySubmissionId == essaySubmissionId)
            .Select(r => r.ReviewerUserId)
            .Distinct()
            .ToListAsync(cancellationToken);
}
