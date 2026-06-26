using MediatR;
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
    private readonly IDocumentContentService _contentService;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(
        IMediator mediator,
        IBlobStorageService blobStorageService,
        IAiService aiService,
        IUnitOfWork unitOfWork,
        IDocumentContentService contentService,
        ILogger<DocumentsController> logger)
    {
        _mediator = mediator;
        _blobStorageService = blobStorageService;
        _aiService = aiService;
        _unitOfWork = unitOfWork;
        _contentService = contentService;
        _logger = logger;
    }
}
