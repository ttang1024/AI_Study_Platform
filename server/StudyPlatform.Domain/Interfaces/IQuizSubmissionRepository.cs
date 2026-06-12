using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IQuizSubmissionRepository : IRepository<QuizSubmission>
{
    Task<QuizSubmission?> GetByDocumentAndUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<QuizSubmission?> GetByVideoAndUserAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<QuizSubmission>> GetAllByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<QuizSubmission>> GetByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);
    Task<(IEnumerable<QuizSubmission> Items, int TotalCount)> GetPagedByUserAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> YouTubeVideoIds)> GetCoverageByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
