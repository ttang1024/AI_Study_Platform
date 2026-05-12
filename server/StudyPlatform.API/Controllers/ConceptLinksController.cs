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

    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<ConceptLinkDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Create([FromBody] CreateConceptLinkRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new CreateConceptLinkCommand(userId, request.SourceType, request.SourceId, request.TargetType, request.TargetId, request.Label),
            cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ConceptLinkDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetKnowledgeGraph), BaseResponse<ConceptLinkDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("{linkId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> Delete(Guid linkId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteConceptLinkCommand(userId, linkId), cancellationToken);
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record CreateConceptLinkRequest(
    string SourceType,
    Guid SourceId,
    string TargetType,
    Guid TargetId,
    string? Label);
