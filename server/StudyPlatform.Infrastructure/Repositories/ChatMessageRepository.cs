using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class ChatMessageRepository : Repository<ChatMessage>, IChatMessageRepository
{
    public ChatMessageRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<ChatMessage>> GetByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.DocumentId == documentId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
    {
        var messages = await _dbSet
            .Where(m => m.DocumentId == documentId && m.UserId == userId)
            .ToListAsync(cancellationToken);
        _dbSet.RemoveRange(messages);
    }

    public async Task<IEnumerable<ChatMessage>> GetByYouTubeVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.YouTubeVideoId == videoId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByYouTubeVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
    {
        var messages = await _dbSet
            .Where(m => m.YouTubeVideoId == videoId && m.UserId == userId)
            .ToListAsync(cancellationToken);
        _dbSet.RemoveRange(messages);
    }

    public async Task<IEnumerable<ChatConversationSummary>> GetConversationSummariesAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var docRows = await _context.ChatMessages
            .Where(m => m.UserId == userId && m.DocumentId != null)
            .Join(_context.Documents,
                m => m.DocumentId,
                d => d.DocumentId,
                (m, d) => new
                {
                    m.Content, m.Role, m.CreatedAt,
                    d.DocumentId, d.FileName, d.CourseId,
                })
            .ToListAsync(cancellationToken);

        var videoRows = await _context.ChatMessages
            .Where(m => m.UserId == userId && m.YouTubeVideoId != null)
            .Join(_context.YouTubeVideos,
                m => m.YouTubeVideoId,
                v => v.YouTubeVideoId,
                (m, v) => new
                {
                    m.Content, m.Role, m.CreatedAt,
                    v.YouTubeVideoId, v.Title, v.CourseId,
                })
            .ToListAsync(cancellationToken);

        var docSummaries = docRows
            .GroupBy(r => r.DocumentId)
            .Select(g =>
            {
                var last = g.MaxBy(r => r.CreatedAt)!;
                return new ChatConversationSummary(
                    "document", g.Key, g.First().FileName, g.First().CourseId,
                    last.Content, last.Role, last.CreatedAt, g.Count());
            });

        var videoSummaries = videoRows
            .GroupBy(r => r.YouTubeVideoId)
            .Select(g =>
            {
                var last = g.MaxBy(r => r.CreatedAt)!;
                return new ChatConversationSummary(
                    "video", g.Key, g.First().Title, g.First().CourseId,
                    last.Content, last.Role, last.CreatedAt, g.Count());
            });

        return docSummaries.Concat(videoSummaries).OrderByDescending(s => s.UpdatedAt);
    }
}
