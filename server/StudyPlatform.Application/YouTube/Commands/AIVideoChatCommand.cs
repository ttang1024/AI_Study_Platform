using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Commands;

public record AIVideoChatCommand(
    Guid VideoId,
    Guid UserId,
    string Message) : IRequest<Result<ChatMessageDto>>;

public class AIVideoChatCommandHandler : IRequestHandler<AIVideoChatCommand, Result<ChatMessageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IYouTubeTranscriptService _transcriptService;

    public AIVideoChatCommandHandler(IUnitOfWork unitOfWork, IAiService aiService, IYouTubeTranscriptService transcriptService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _transcriptService = transcriptService;
    }

    public async Task<Result<ChatMessageDto>> Handle(AIVideoChatCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null)
            return Result<ChatMessageDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var history = await _unitOfWork.ChatMessages.GetByYouTubeVideoIdAsync(request.VideoId, request.UserId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();

        // Use stored transcript if available; otherwise fetch, store, and return.
        string transcriptText;
        if (!string.IsNullOrEmpty(video.Transcript))
        {
            transcriptText = video.Transcript;
        }
        else
        {
            var segments = await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken)
                           ?? await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken);
            transcriptText = segments != null && segments.Count > 0
                ? string.Join(" ", segments.Select(s => s.Text))
                : string.Empty;
            if (!string.IsNullOrEmpty(transcriptText))
            {
                video.Transcript = transcriptText;
                video.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.YouTubeVideos.Update(video);
            }
        }

        var userMessage = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            YouTubeVideoId = request.VideoId,
            SourceType = "video",
            UserId = request.UserId,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.ChatMessages.AddAsync(userMessage, cancellationToken);

        var aiResponse = await _aiService.ChatWithYouTubeAsync(transcriptText, historyTuples, request.Message, cancellationToken);

        var assistantMessage = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            YouTubeVideoId = request.VideoId,
            SourceType = "video",
            UserId = request.UserId,
            Role = "assistant",
            Content = aiResponse,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.ChatMessages.AddAsync(assistantMessage, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new ChatMessageDto(
            assistantMessage.MessageId,
            assistantMessage.DocumentId,
            assistantMessage.YouTubeVideoId,
            assistantMessage.SourceType,
            assistantMessage.Role,
            assistantMessage.Content,
            assistantMessage.CreatedAt);

        return Result<ChatMessageDto>.Success(dto, "Message sent successfully.");
    }
}

public record GetVideoChatHistoryQuery(Guid VideoId, Guid UserId) : IRequest<Result<IEnumerable<ChatMessageDto>>>;

public class GetVideoChatHistoryQueryHandler : IRequestHandler<GetVideoChatHistoryQuery, Result<IEnumerable<ChatMessageDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetVideoChatHistoryQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<ChatMessageDto>>> Handle(GetVideoChatHistoryQuery request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null)
            return Result<IEnumerable<ChatMessageDto>>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var messages = await _unitOfWork.ChatMessages.GetByYouTubeVideoIdAsync(request.VideoId, request.UserId, cancellationToken);
        var dtos = messages.Select(m => new ChatMessageDto(m.MessageId, m.DocumentId, m.YouTubeVideoId, m.SourceType, m.Role, m.Content, m.CreatedAt));

        return Result<IEnumerable<ChatMessageDto>>.Success(dtos);
    }
}
