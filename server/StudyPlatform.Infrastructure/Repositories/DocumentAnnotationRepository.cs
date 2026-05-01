using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class DocumentAnnotationRepository : Repository<DocumentAnnotation>, IDocumentAnnotationRepository
{
    public DocumentAnnotationRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<DocumentAnnotation>> GetByDocumentAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(a => a.DocumentId == documentId && a.UserId == userId)
            .OrderBy(a => a.PageNumber)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync(cancellationToken);
}
