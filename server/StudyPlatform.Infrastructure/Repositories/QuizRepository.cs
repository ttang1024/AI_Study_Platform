using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class QuizRepository : Repository<Quiz>, IQuizRepository
{
    public QuizRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Quiz>> GetByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(q => q.DocumentId == documentId)
            .OrderBy(q => q.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByDocumentIdAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var quizzes = await _dbSet.Where(q => q.DocumentId == documentId).ToListAsync(cancellationToken);
        _dbSet.RemoveRange(quizzes);
    }
}
