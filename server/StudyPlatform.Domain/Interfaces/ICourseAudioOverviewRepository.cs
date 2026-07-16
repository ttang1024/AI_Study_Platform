using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface ICourseAudioOverviewRepository : IRepository<CourseAudioOverview>
{
    Task<CourseAudioOverview?> GetLatestForCourseAsync(Guid userId, Guid courseId, CancellationToken cancellationToken = default);
}
