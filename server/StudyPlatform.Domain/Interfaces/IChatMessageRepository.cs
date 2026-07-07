using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IChatMessageRepository : IRepository<ChatMessage>
{
    Task<IEnumerable<ChatMessage>> GetByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ChatMessage>> GetByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<ChatConversation> CreateConversationAsync(Guid userId, string title, CancellationToken cancellationToken = default);
    Task<ChatConversation> CreateVideoConversationAsync(Guid userId, Guid videoId, string title, CancellationToken cancellationToken = default);
    Task<ChatConversation> CreateDocumentConversationAsync(Guid userId, Guid documentId, string title, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChatConversation>> GetConversationsByVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChatConversation>> GetConversationsByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChatThreadSummary>> GetVideoThreadSummariesAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ChatThreadSummary>> GetDocumentThreadSummariesAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<ChatConversation?> GetConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ChatMessage>> GetByConversationIdAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    void UpdateConversation(ChatConversation conversation);
    Task<IReadOnlyList<Guid>> GetVideoIdsWithLegacyChatAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Guid>> GetDocumentIdsWithLegacyChatAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ChatConversationSummary>> GetConversationSummariesAsync(Guid userId, CancellationToken cancellationToken = default);
}
