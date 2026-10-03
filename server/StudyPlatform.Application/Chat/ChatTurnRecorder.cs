using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Chat;

/// <inheritdoc cref="IChatTurnRecorder"/>
public class ChatTurnRecorder : IChatTurnRecorder
{
    private readonly IUnitOfWork _unitOfWork;

    public ChatTurnRecorder(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public Task RecordUserAsync(
        ChatThread thread,
        string content,
        string? attachmentsJson = null,
        string? title = null,
        CancellationToken cancellationToken = default)
        => RecordAsync(thread, "user", content, attachmentsJson, title, cancellationToken);

    public Task RecordAssistantAsync(ChatThread thread, string content, CancellationToken cancellationToken = default)
        => RecordAsync(thread, "assistant", content, null, null, cancellationToken);

    private async Task RecordAsync(
        ChatThread thread,
        string role,
        string content,
        string? attachmentsJson,
        string? title,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        if (title != null)
            thread.Conversation.Title = title;
        thread.Conversation.UpdatedAt = now;
        _unitOfWork.ChatMessages.UpdateConversation(thread.Conversation);

        await _unitOfWork.ChatMessages.AddAsync(new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            ChatConversationId = thread.Conversation.ConversationId,
            DocumentId = thread.DocumentId,
            VideoId = thread.VideoId,
            SourceType = thread.SourceType,
            UserId = thread.UserId,
            Role = role,
            Content = content,
            AttachmentsJson = attachmentsJson,
            CreatedAt = now
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
