using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Application.Videos.Transcripts;

namespace StudyPlatform.API.Controllers;

public record PlaylistVideoItemDto(string VideoId, string Title, string ThumbnailUrl);
public record VideoUrlRequest(string VideoUrl);
public record VideoChatRequest(string VideoUrl, string Message, IEnumerable<ChatHistoryEntry> History, IEnumerable<ChatAttachmentDto>? Attachments = null);
public record ChatHistoryEntry(string Role, string Content);

[ApiController]
[Route("api/videos")]
[Authorize]
[Produces("application/json")]
public partial class VideoController : ControllerBase
{
    private readonly IYouTubeTranscriptService _transcriptService;
    private readonly IAiService _aiService;
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly IAppCache _cache;
    private readonly IBlobStorageService _blobStorageService;
    private readonly ITranscriptionService _transcriptionService;
    private readonly ITokenService _tokenService;
    private readonly IChatTurnRecorder _chatTurns;
    private readonly CacheOptions _cacheOptions;
    private readonly AppLimitsOptions _limits;

    public VideoController(IYouTubeTranscriptService transcriptService, IAiService aiService, IMediator mediator, IUnitOfWork unitOfWork, IVideoTranscriptProvider transcripts, IAppCache cache, IBlobStorageService blobStorageService, ITranscriptionService transcriptionService, ITokenService tokenService, IChatTurnRecorder chatTurns, IOptions<CacheOptions> cacheOptions, IOptions<AppLimitsOptions> limits)
    {
        _transcriptService = transcriptService;
        _aiService = aiService;
        _mediator = mediator;
        _unitOfWork = unitOfWork;
        _transcripts = transcripts;
        _cache = cache;
        _blobStorageService = blobStorageService;
        _transcriptionService = transcriptionService;
        _tokenService = tokenService;
        _chatTurns = chatTurns;
        _cacheOptions = cacheOptions.Value;
        _limits = limits.Value;
    }
}
