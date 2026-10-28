using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Application.Videos.Generation;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Application.Videos;

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
    private readonly IQuizRepository _quizzes;
    private readonly IFlashcardRepository _flashcards;
    private readonly INoteRepository _notes;
    private readonly IChatMessageRepository _chatMessages;
    private readonly IQuizSubmissionRepository _quizSubmissions;
    private readonly IVideoAccess _videoAccess;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly IAppCache _cache;
    private readonly IBlobStorageService _blobStorageService;
    private readonly ITokenService _tokenService;
    private readonly IChatTurnRecorder _chatTurns;
    private readonly IVideoAiGenerator _videoAi;
    private readonly CacheOptions _cacheOptions;

    public VideoController(IYouTubeTranscriptService transcriptService, IAiService aiService, IMediator mediator, IUnitOfWork unitOfWork, IQuizRepository quizzes, IFlashcardRepository flashcards, INoteRepository notes, IChatMessageRepository chatMessages, IQuizSubmissionRepository quizSubmissions, IVideoAccess videoAccess, IVideoTranscriptProvider transcripts, IAppCache cache, IBlobStorageService blobStorageService, ITokenService tokenService, IChatTurnRecorder chatTurns, IVideoAiGenerator videoAi, IOptions<CacheOptions> cacheOptions)
    {
        _transcriptService = transcriptService;
        _aiService = aiService;
        _mediator = mediator;
        _unitOfWork = unitOfWork;
        _quizzes = quizzes;
        _flashcards = flashcards;
        _notes = notes;
        _chatMessages = chatMessages;
        _quizSubmissions = quizSubmissions;
        _videoAccess = videoAccess;
        _transcripts = transcripts;
        _cache = cache;
        _blobStorageService = blobStorageService;
        _tokenService = tokenService;
        _chatTurns = chatTurns;
        _videoAi = videoAi;
        _cacheOptions = cacheOptions.Value;
    }
}
