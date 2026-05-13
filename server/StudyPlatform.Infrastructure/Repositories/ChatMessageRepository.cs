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

    public async Task<ChatConversation> CreateConversationAsync(Guid userId, string title, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var conversation = new ChatConversation
        {
            ConversationId = Guid.NewGuid(),
            UserId = userId,
            Title = string.IsNullOrWhiteSpace(title) ? "New conversation" : title.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _context.ChatConversations.AddAsync(conversation, cancellationToken);
        return conversation;
    }

    public async Task<ChatConversation?> GetConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
        => await _context.ChatConversations
            .FirstOrDefaultAsync(c => c.ConversationId == conversationId && c.UserId == userId, cancellationToken);

    public async Task<IEnumerable<ChatMessage>> GetByConversationIdAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.ChatConversationId == conversationId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await GetConversationAsync(conversationId, userId, cancellationToken);
        if (conversation is not null)
            _context.ChatConversations.Remove(conversation);
    }

    public void UpdateConversation(ChatConversation conversation)
        => _context.ChatConversations.Update(conversation);

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

        var generalRows = await _context.ChatConversations
            .Include(c => c.Messages)
            .Where(c => c.UserId == userId)
            .ToListAsync(cancellationToken);

        var generalSummaries = generalRows.Select(r =>
        {
            var messages = r.Messages.OrderByDescending(m => m.CreatedAt).ToList();
            var last = messages.FirstOrDefault();
            return new ChatConversationSummary(
                "general", r.ConversationId, r.Title, null,
                last?.Content ?? string.Empty, last?.Role ?? string.Empty,
                last?.CreatedAt ?? r.UpdatedAt, messages.Count);
        });

        return docSummaries.Concat(videoSummaries).Concat(generalSummaries).OrderByDescending(s => s.UpdatedAt);
    }
}
