using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Glossary.Commands;

namespace StudyPlatform.API.Controllers;

public record UpdateGlossaryTermRequest(string Term, string Definition);

[ApiController]
[Route("api/glossary")]
[Authorize]
[Produces("application/json")]
public class GlossaryController : ControllerBase
{
    private readonly IMediator _mediator;

    public GlossaryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get all glossary terms for the authenticated user
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<GlossaryTermDto>>), 200)]
    public async Task<IActionResult> GetAll()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllGlossaryTermsQuery(userId));
        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get all mastered glossary term IDs for the authenticated user
    /// </summary>
    [HttpGet("mastered")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<Guid>>), 200)]
    public async Task<IActionResult> GetMastered()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetMasteredGlossaryIdsQuery(userId));
        return Ok(BaseResponse<IEnumerable<Guid>>.Ok(result.Data!));
    }

    /// <summary>
    /// Toggle mastery for a glossary term (marks as mastered if not; unmarks if already mastered)
    /// </summary>
    [HttpPost("mastered/{termId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    public async Task<IActionResult> ToggleMastered(Guid termId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ToggleGlossaryMasteredCommand(userId, termId));
        return Ok(BaseResponse<bool>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Update a glossary term's text and definition
    /// </summary>
    [HttpPut("terms/{termId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<GlossaryTermDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateTerm(Guid termId, [FromBody] UpdateGlossaryTermRequest body)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateGlossaryTermCommand(userId, termId, body.Term, body.Definition));
        if (!result.IsSuccess) return NotFound(result.Message);
        return Ok(BaseResponse<GlossaryTermDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a glossary term
    /// </summary>
    [HttpDelete("terms/{termId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteTerm(Guid termId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteGlossaryTermCommand(userId, termId));
        if (!result.IsSuccess) return NotFound(result.Message);
        return Ok(BaseResponse<bool>.Ok(result.Data!, result.Message));
    }
}
