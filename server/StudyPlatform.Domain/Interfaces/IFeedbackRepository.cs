using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFeedbackRepository : IRepository<Feedback>
{
    Task<(IEnumerable<Feedback> Items, int Total)> ListAsync(
        int page, int pageSize,
        string? status, string? type, string? search, string? sort,
        CancellationToken cancellationToken = default);
}
