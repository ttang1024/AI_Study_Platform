using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IGlossaryMasteredRepository
{
    Task<IEnumerable<Guid>> GetMasteredTermIdsByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<GlossaryMastered?> GetByUserAndTermAsync(Guid userId, Guid termId, CancellationToken cancellationToken = default);
    Task AddAsync(GlossaryMastered mastered, CancellationToken cancellationToken = default);
    void Remove(GlossaryMastered mastered);
}
