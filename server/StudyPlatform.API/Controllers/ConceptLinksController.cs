using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/concept-links")]
[Authorize]
[Produces("application/json")]
public class ConceptLinksController : ControllerBase
{
    private readonly IMediator _mediator;

    public ConceptLinksController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("knowledge-graph")]
    [ProducesResponseType(typeof(BaseResponse<KnowledgeGraphDto>), 200)]
    public async Task<IActionResult> GetKnowledgeGraph(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetKnowledgeGraphQuery(userId), cancellationToken);
        return Ok(BaseResponse<KnowledgeGraphDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get knowledge gaps and cross-course dependencies derived from the concept graph
    /// </summary>
    [HttpGet("gaps")]
    [ProducesResponseType(typeof(BaseResponse<KnowledgeGapsDto>), 200)]
    public async Task<IActionResult> GetKnowledgeGaps(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetKnowledgeGapsQuery(userId), cancellationToken);
        return Ok(BaseResponse<KnowledgeGapsDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Prerequisite-ordered learning path over the user's concepts ("what should I learn next").
    /// </summary>
    [HttpGet("learning-path")]
    [ProducesResponseType(typeof(BaseResponse<LearningPathDto>), 200)]
    public async Task<IActionResult> GetLearningPath(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetLearningPathQuery(userId), cancellationToken);
        return Ok(BaseResponse<LearningPathDto>.Ok(result.Data!));
    }
}
