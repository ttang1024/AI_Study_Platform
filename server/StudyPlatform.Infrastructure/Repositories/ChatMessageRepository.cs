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

    public async Task<IEnumerable<ChatMessage>> GetByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.VideoId == videoId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task DeleteByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
    {
        var messages = await _dbSet
            .Where(m => m.VideoId == videoId && m.UserId == userId)
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

    public async Task<ChatConversation> CreateVideoConversationAsync(Guid userId, Guid videoId, string title, CancellationToken cancellationToken = default)
    {
        var conversation = await CreateConversationAsync(userId, title, cancellationToken);
        conversation.VideoId = videoId;
        return conversation;
    }

    public async Task<ChatConversation> CreateDocumentConversationAsync(Guid userId, Guid documentId, string title, CancellationToken cancellationToken = default)
    {
        var conversation = await CreateConversationAsync(userId, title, cancellationToken);
        conversation.DocumentId = documentId;
        return conversation;
    }

    public async Task<IReadOnlyList<ChatConversation>> GetConversationsByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
        => await _context.ChatConversations
            .Where(c => c.VideoId == videoId && c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ChatConversation>> GetConversationsByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => await _context.ChatConversations
            .Where(c => c.DocumentId == documentId && c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(cancellationToken);

    public Task<IReadOnlyList<ChatThreadSummary>> GetVideoThreadSummariesAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default)
        => GetThreadSummariesAsync(c => c.VideoId == videoId && c.UserId == userId, cancellationToken);

    public Task<IReadOnlyList<ChatThreadSummary>> GetDocumentThreadSummariesAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default)
        => GetThreadSummariesAsync(c => c.DocumentId == documentId && c.UserId == userId, cancellationToken);

    private async Task<IReadOnlyList<ChatThreadSummary>> GetThreadSummariesAsync(
        System.Linq.Expressions.Expression<Func<ChatConversation, bool>> filter,
        CancellationToken cancellationToken)
        => await _context.ChatConversations
            .Where(filter)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new ChatThreadSummary(
                c.ConversationId, c.Title, c.CreatedAt, c.UpdatedAt,
                c.Messages.Count,
                c.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.Content).FirstOrDefault()))
            .ToListAsync(cancellationToken);

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

    public async Task<IReadOnlyList<Guid>> GetVideoIdsWithLegacyChatAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.UserId == userId && m.VideoId != null && m.ChatConversationId == null)
            .Select(m => m.VideoId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetDocumentIdsWithLegacyChatAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.UserId == userId && m.DocumentId != null && m.ChatConversationId == null)
            .Select(m => m.DocumentId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<ChatConversationSummary>> GetConversationSummariesAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // One summary per conversation thread (not per source), so a video or
        // document with several threads shows each of them separately.
        var docThreads = await _context.ChatConversations
            .Where(c => c.UserId == userId && c.DocumentId != null)
            .Join(_context.Documents,
                c => c.DocumentId,
                d => d.DocumentId,
                (c, d) => new
                {
                    c.ConversationId, ThreadTitle = c.Title, c.UpdatedAt,
                    d.DocumentId, d.FileName, d.CourseId,
                    MessageCount = c.Messages.Count,
                    Last = c.Messages.OrderByDescending(m => m.CreatedAt)
                        .Select(m => new { m.Content, m.Role, m.CreatedAt })
                        .FirstOrDefault(),
                })
            .ToListAsync(cancellationToken);

        var videoThreads = await _context.ChatConversations
            .Where(c => c.UserId == userId && c.VideoId != null)
            .Join(_context.Videos,
                c => c.VideoId,
                v => v.VideoId,
                (c, v) => new
                {
                    c.ConversationId, ThreadTitle = c.Title, c.UpdatedAt,
                    v.VideoId, v.Title, v.CourseId,
                    MessageCount = c.Messages.Count,
                    Last = c.Messages.OrderByDescending(m => m.CreatedAt)
                        .Select(m => new { m.Content, m.Role, m.CreatedAt })
                        .FirstOrDefault(),
                })
            .ToListAsync(cancellationToken);

        var docSummaries = docThreads.Select(t => new ChatConversationSummary(
            "document", t.DocumentId, t.FileName, t.CourseId,
            t.ConversationId, t.ThreadTitle,
            t.Last?.Content ?? string.Empty, t.Last?.Role ?? string.Empty,
            t.Last?.CreatedAt ?? t.UpdatedAt, t.MessageCount));

        var videoSummaries = videoThreads.Select(t => new ChatConversationSummary(
            "video", t.VideoId, t.Title, t.CourseId,
            t.ConversationId, t.ThreadTitle,
            t.Last?.Content ?? string.Empty, t.Last?.Role ?? string.Empty,
            t.Last?.CreatedAt ?? t.UpdatedAt, t.MessageCount));

        var generalRows = await _context.ChatConversations
            .Include(c => c.Messages)
            .Where(c => c.UserId == userId && c.VideoId == null && c.DocumentId == null)
            .ToListAsync(cancellationToken);

        var generalSummaries = generalRows.Select(r =>
        {
            var messages = r.Messages.OrderByDescending(m => m.CreatedAt).ToList();
            var last = messages.FirstOrDefault();
            return new ChatConversationSummary(
                "general", r.ConversationId, r.Title, null,
                r.ConversationId, r.Title,
                last?.Content ?? string.Empty, last?.Role ?? string.Empty,
                last?.CreatedAt ?? r.UpdatedAt, messages.Count);
        });

        return docSummaries.Concat(videoSummaries).Concat(generalSummaries).OrderByDescending(s => s.UpdatedAt);
    }
}
