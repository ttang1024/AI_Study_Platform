using MediatR;
using StudyPlatform.Application.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/documents")]
[Authorize]
[Produces("application/json")]
public partial class DocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IAiService _aiService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IChatMessageRepository _chatMessages;
    private readonly IDocumentContentService _contentService;
    private readonly IChatTurnRecorder _chatTurns;
    private readonly IDocumentAiStreams _documentAi;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(
        IMediator mediator,
        IBlobStorageService blobStorageService,
        IAiService aiService,
        IUnitOfWork unitOfWork,
        IDocumentRepository documents,
        IChatMessageRepository chatMessages,
        IDocumentContentService contentService,
        IChatTurnRecorder chatTurns,
        IDocumentAiStreams documentAi,
        ILogger<DocumentsController> logger)
    {
        _mediator = mediator;
        _blobStorageService = blobStorageService;
        _aiService = aiService;
        _unitOfWork = unitOfWork;
        _documents = documents;
        _chatMessages = chatMessages;
        _contentService = contentService;
        _chatTurns = chatTurns;
        _documentAi = documentAi;
        _logger = logger;
    }
}
