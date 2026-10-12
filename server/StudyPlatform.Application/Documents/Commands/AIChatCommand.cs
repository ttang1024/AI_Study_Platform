using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record AIChatCommand(
    Guid DocumentId,
    Guid UserId,
    string Message) : IRequest<Result<ChatMessageDto>>;

public class AIChatCommandHandler : IRequestHandler<AIChatCommand, Result<ChatMessageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IChatMessageRepository _chatMessages;
    private readonly IAiService _aiService;
    private readonly IDocumentTextExtractor _textExtractor;

    public AIChatCommandHandler(
        IUnitOfWork unitOfWork,
        IDocumentRepository documents,
        IChatMessageRepository chatMessages,
        IAiService aiService,
        IDocumentTextExtractor textExtractor)
    {
        _unitOfWork = unitOfWork;
        _documents = documents;
        _chatMessages = chatMessages;
        _aiService = aiService;
        _textExtractor = textExtractor;
    }

    public async Task<Result<ChatMessageDto>> Handle(AIChatCommand request, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (document == null)
            return Result<ChatMessageDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var history = await _chatMessages.GetByDocumentIdAsync(request.DocumentId, request.UserId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();

        var content = document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
            ? document.Transcript ?? string.Empty
            : await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);

        var userMessage = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            SourceType = "document",
            UserId = request.UserId,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessages.AddAsync(userMessage, cancellationToken);

        var aiResponse = await _aiService.ChatAsync(content, request.Message, historyTuples, cancellationToken);

        var assistantMessage = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            SourceType = "document",
            UserId = request.UserId,
            Role = "assistant",
            Content = aiResponse,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessages.AddAsync(assistantMessage, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ChatMessageDto>.Success(assistantMessage.ToChatMessageDto(), "Message sent successfully.");
    }
}
