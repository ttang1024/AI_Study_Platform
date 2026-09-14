using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface ICourseCertificateRepository : IRepository<CourseCertificate>
{
    Task<IReadOnlyList<CourseCertificate>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>The user's live certificate for a course, if they already hold one.</summary>
    Task<CourseCertificate?> GetForCourseAsync(Guid userId, Guid courseId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the public verification link. Returns revoked certificates too — the verification
    /// page has to be able to say "this was revoked" rather than "no such certificate".
    /// </summary>
    Task<CourseCertificate?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
}
