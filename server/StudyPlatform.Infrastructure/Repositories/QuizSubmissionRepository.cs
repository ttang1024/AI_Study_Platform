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
            .FirstOrDefaultAsync(s => s.VideoId == videoId && s.UserId == userId, cancellationToken);

    public async Task<IEnumerable<QuizSubmission>> GetAllByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SubmittedAt)
            .ToListWithSourcesAsync(cancellationToken);

    public async Task<IEnumerable<QuizSubmission>> GetByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(s => s.UserId == userId && s.SubmittedAt >= from.Date && s.SubmittedAt < to.Date.AddDays(1))
            .ToListAsync(cancellationToken);

    public async Task<(IEnumerable<QuizSubmission> Items, int TotalCount)> GetPagedByUserAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(s => s.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListWithSourcesAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<QuizAchievements> GetAchievementsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var row = await _dbSet
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.Total > 0)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Perfect = g.Count(s => s.Score == s.Total),
                Scored = g.Count(),
                Average = g.Average(s => (double)s.Score / s.Total * 100),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row == null
            ? QuizAchievements.Empty
            : new QuizAchievements(row.Perfect, row.Scored, row.Average);
    }

    public async Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> VideoIds)> GetCoverageByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var documentIds = await _dbSet
            .Where(s => s.UserId == userId && s.DocumentId != null && s.SourceType != "video")
            .Select(s => s.DocumentId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var videoIds = await _dbSet
            .Where(s => s.UserId == userId && s.VideoId != null)
            .Select(s => s.VideoId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        return (documentIds, videoIds);
    }
}
