using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Which thread a chat turn belongs to, and what it hangs off.
/// </summary>
/// <param name="SourceType">"document", "video" or "general" — the discriminator saved on the row.</param>
public readonly record struct ChatThread(
    Guid UserId,
    ChatConversation Conversation,
    string SourceType,
    Guid? DocumentId = null,
    Guid? VideoId = null);

/// <summary>
/// Persists the two halves of a streamed chat turn: the user's message before the model is called,
/// and the assistant's once the stream completes.
///
/// <para>Document chat, video chat and standalone chat all stream through the same SSE helper and
/// all have to save the same pair of rows around it, keeping the conversation's <c>UpdatedAt</c> in
/// step. Doing that in one place is what keeps a thread's history well-formed no matter which
/// surface produced it.</para>
/// </summary>
public interface IChatTurnRecorder
{
    /// <param name="title">When given, renames the thread — used to title a thread from its first message.</param>
    Task RecordUserAsync(
        ChatThread thread,
        string content,
        string? attachmentsJson = null,
        string? title = null,
        CancellationToken cancellationToken = default);

    Task RecordAssistantAsync(ChatThread thread, string content, CancellationToken cancellationToken = default);
}
