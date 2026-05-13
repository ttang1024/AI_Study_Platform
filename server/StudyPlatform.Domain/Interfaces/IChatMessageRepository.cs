using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IChatMessageRepository : IRepository<ChatMessage>
{
    Task<IEnumerable<ChatMessage>> GetByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteByDocumentIdAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ChatMessage>> GetByYouTubeVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteByYouTubeVideoIdAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<ChatConversation> CreateConversationAsync(Guid userId, string title, CancellationToken cancellationToken = default);
    Task<ChatConversation?> GetConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ChatMessage>> GetByConversationIdAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    Task DeleteConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    void UpdateConversation(ChatConversation conversation);
    Task<IEnumerable<ChatConversationSummary>> GetConversationSummariesAsync(Guid userId, CancellationToken cancellationToken = default);
}
