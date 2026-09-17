using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Write side of page-view tracking. Reads are deliberately absent: a visit row is only ever
/// aggregated across every user, which is <see cref="IAdminAnalyticsRepository"/>'s job.
/// </summary>
public interface IPageVisitRepository : IRepository<PageVisit>
{
}
