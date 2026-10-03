using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// The admin feedback dashboard's header numbers. Aggregated in the database — this is the one repository
/// that reads across all users, so "load every row and count in memory" grows with the whole platform.
/// </summary>
public record FeedbackStats(
    int Total,
    IReadOnlyDictionary<string, int> ByType,
    IReadOnlyDictionary<string, int> ByStatus,
    double? AverageRating,
    int RecentCount);

public interface IFeedbackRepository : IRepository<Feedback>
{
    /// <summary>Counts by type and status, mean rating, and submissions since <paramref name="since"/>.</summary>
    Task<FeedbackStats> GetStatsAsync(DateTime since, CancellationToken cancellationToken = default);

    Task<(IEnumerable<Feedback> Items, int Total)> ListAsync(
        int page, int pageSize,
        string? status, string? type, string? search, string? sort,
        CancellationToken cancellationToken = default);
}
