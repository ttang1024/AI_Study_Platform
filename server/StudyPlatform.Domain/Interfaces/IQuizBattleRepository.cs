using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IQuizBattleRepository : IRepository<QuizBattle>
{
    Task<IEnumerable<QuizBattle>> GetByGroupWithEntriesAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task<QuizBattle?> GetByIdWithEntriesAsync(Guid battleId, CancellationToken cancellationToken = default);
    Task AddEntryAsync(QuizBattleEntry entry, CancellationToken cancellationToken = default);
}
