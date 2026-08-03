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

public interface IEssayPeerReviewRepository : IRepository<EssayPeerReview>
{
    /// <summary>Reviews of one draft. Used by the author, so only submitted ones are worth showing.</summary>
    Task<IReadOnlyList<EssayPeerReview>> GetForSubmissionAsync(
        Guid essaySubmissionId, CancellationToken cancellationToken = default);

    /// <summary>A reviewer's queue, with the drafts attached so the list can be rendered in one pass.</summary>
    Task<IReadOnlyList<EssayPeerReview>> GetAssignedToReviewerAsync(
        Guid reviewerUserId, bool includeSubmitted, CancellationToken cancellationToken = default);

    /// <summary>One assignment, with its submission loaded — the read path a reviewer opens.</summary>
    Task<EssayPeerReview?> GetWithSubmissionAsync(
        Guid essayPeerReviewId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Users already assigned to review this draft, so a second round does not ask the same person
    /// twice.
    /// </summary>
    Task<IReadOnlyList<Guid>> GetExistingReviewerIdsAsync(
        Guid essaySubmissionId, CancellationToken cancellationToken = default);
}
