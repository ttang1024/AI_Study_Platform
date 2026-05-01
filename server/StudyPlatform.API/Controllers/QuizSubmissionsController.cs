using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/quiz-submissions")]
[Authorize]
[Produces("application/json")]
public class QuizSubmissionsController : ControllerBase
{
    private readonly IMediator _mediator;

    public QuizSubmissionsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get all quiz submissions for the current user (paginated)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<QuizSubmissionDto>>), 200)]
    public async Task<IActionResult> GetAllSubmissions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllQuizSubmissionsPagedQuery(userId, page, pageSize));
        return Ok(BaseResponse<PaginatedList<QuizSubmissionDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get source IDs that already have submitted quizzes for the authenticated user
    /// </summary>
    [HttpGet("coverage")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionCoverageDto>), 200)]
    public async Task<IActionResult> GetCoverage()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetQuizSubmissionCoverageQuery(userId));
        return Ok(BaseResponse<QuizSubmissionCoverageDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get materials that do not yet have submitted quizzes for the authenticated user
    /// </summary>
    [HttpGet("pending-materials")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<PendingMaterialDto>>), 200)]
    public async Task<IActionResult> GetPendingMaterials()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetPendingQuizMaterialsQuery(userId));
        return Ok(BaseResponse<IEnumerable<PendingMaterialDto>>.Ok(result.Data!));
    }
}
