using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class QuizSubmissionRepository : Repository<QuizSubmission>, IQuizSubmissionRepository
{
    public QuizSubmissionRepository(AppDbContext context) : base(context) { }

    public async Task<QuizSubmission?> GetByDocumentAndUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(s => s.DocumentId == documentId && s.UserId == userId, cancellationToken);

    public async Task<QuizSubmission?> GetByVideoAndUserAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .FirstOrDefaultAsync(s => s.YouTubeVideoId == videoId && s.UserId == userId, cancellationToken);

    public async Task<IEnumerable<QuizSubmission>> GetAllByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(s => s.Document)
            .Include(s => s.YouTubeVideo)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SubmittedAt)
            .ToListAsync(cancellationToken);

    public async Task<(IEnumerable<QuizSubmission> Items, int TotalCount)> GetPagedByUserAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .Include(s => s.Document)
            .Include(s => s.YouTubeVideo)
            .Where(s => s.UserId == userId);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(s => s.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> YouTubeVideoIds)> GetCoverageByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var documentIds = await _dbSet
            .Where(s => s.UserId == userId && s.DocumentId != null && s.SourceType != "video")
            .Select(s => s.DocumentId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var youTubeVideoIds = await _dbSet
            .Where(s => s.UserId == userId && s.YouTubeVideoId != null)
            .Select(s => s.YouTubeVideoId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        return (documentIds, youTubeVideoIds);
    }
}
