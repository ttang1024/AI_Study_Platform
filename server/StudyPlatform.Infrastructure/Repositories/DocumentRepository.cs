using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class DocumentRepository : Repository<Document>, IDocumentRepository
{
    public DocumentRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.CourseId == courseId && d.UserId == userId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.CourseId == courseId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<Document?> GetByIdWithDetailsAsync(Guid documentId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(d => d.Notes)
            .Include(d => d.Quizzes)
            .Include(d => d.Flashcards)
            .Include(d => d.ChatMessages)
            .FirstOrDefaultAsync(d => d.DocumentId == documentId, cancellationToken);

    public async Task<bool> BelongsToUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.AnyAsync(d => d.DocumentId == documentId && d.UserId == userId, cancellationToken);

    public async Task<IEnumerable<Document>> GetByUserIdAsync(Guid userId, DateTime date, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.UserId == userId && d.CreatedAt.Date == date.Date)
            .ToListAsync(cancellationToken);

    public async Task<(IEnumerable<Document> Items, int TotalCount)> GetAllByUserIdAsync(Guid userId, int page, int pageSize, Guid? courseId, CancellationToken cancellationToken = default)
    {
        var query = _dbSet.Where(d => d.UserId == userId);
        if (courseId.HasValue)
            query = query.Where(d => d.CourseId == courseId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<Document?> GetByUserIdAndFileHashAsync(Guid userId, string fileHash, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(d => d.UserId == userId && d.FileHash == fileHash)
            .OrderByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.CountAsync(d => d.UserId == userId, cancellationToken);
}
