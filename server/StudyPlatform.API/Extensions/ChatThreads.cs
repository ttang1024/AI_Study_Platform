using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Extensions;

/// <summary>Optional title for a new chat thread; auto-titled from the first message when omitted.</summary>
public record CreateChatThreadRequest(string? Title);

/// <summary>
/// Shared helpers for per-source chat threads (video and document chat):
/// auto-titling and folding pre-thread ("legacy") messages into a conversation.
/// </summary>
public static class ChatThreads
{
    public const string DefaultTitle = "New conversation";

    /// <summary>
    /// The assistant turn recorded when a reply never finished (the viewer left, or the provider
    /// failed). Recording something keeps the thread alternating; leaving the user's turn unanswered
    /// showed a question with no reply and fed the model two user turns in a row next time.
    /// </summary>
    public static string InterruptedReply(string partial)
        => string.IsNullOrWhiteSpace(partial)
            ? "_(No reply — the response was interrupted.)_"
            : partial.TrimEnd() + "\n\n_(Response interrupted.)_";

    /// <summary>Thread title derived from its first user message.</summary>
    public static string TitleFrom(string? firstUserMessage)
    {
        var t = (firstUserMessage ?? string.Empty).Trim().Replace('\n', ' ');
        if (t.Length == 0) return DefaultTitle;
        return t.Length <= 60 ? t : t[..60].TrimEnd() + "…";
    }

    /// <summary>
    /// Folds a video's messages saved before threads existed (no conversation id)
    /// into a conversation, so history predating the feature stays visible.
    /// </summary>
    public static Task AdoptLegacyVideoChatAsync(IChatMessageRepository chatMessages, IUnitOfWork unitOfWork, Guid videoId, Guid userId, CancellationToken cancellationToken)
        => AdoptAsync(
            chatMessages,
            unitOfWork,
            () => chatMessages.GetByVideoIdAsync(videoId, userId, cancellationToken),
            title => chatMessages.CreateVideoConversationAsync(userId, videoId, title, cancellationToken),
            cancellationToken);

    /// <summary>Document counterpart of <see cref="AdoptLegacyVideoChatAsync"/>.</summary>
    public static Task AdoptLegacyDocumentChatAsync(IChatMessageRepository chatMessages, IUnitOfWork unitOfWork, Guid documentId, Guid userId, CancellationToken cancellationToken)
        => AdoptAsync(
            chatMessages,
            unitOfWork,
            () => chatMessages.GetByDocumentIdAsync(documentId, userId, cancellationToken),
            title => chatMessages.CreateDocumentConversationAsync(userId, documentId, title, cancellationToken),
            cancellationToken);

    private static async Task AdoptAsync(
        IChatMessageRepository chatMessages,
        IUnitOfWork unitOfWork,
        Func<Task<IEnumerable<Domain.Entities.ChatMessage>>> loadMessages,
        Func<string, Task<Domain.Entities.ChatConversation>> createConversation,
        CancellationToken cancellationToken)
    {
        var legacy = (await loadMessages())
            .Where(m => m.ChatConversationId == null)
            .OrderBy(m => m.CreatedAt)
            .ToList();
        if (legacy.Count == 0) return;

        var conversation = await createConversation(TitleFrom(legacy.FirstOrDefault(m => m.Role == "user")?.Content));
        conversation.CreatedAt = legacy[0].CreatedAt;
        conversation.UpdatedAt = legacy[^1].CreatedAt;
        foreach (var m in legacy)
        {
            m.ChatConversationId = conversation.ConversationId;
            chatMessages.Update(m);
        }
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
