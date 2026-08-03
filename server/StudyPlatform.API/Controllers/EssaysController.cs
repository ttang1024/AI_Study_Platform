using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Essays;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Rubric-based feedback on writing. Drafts are chained rather than overwritten, so a learner can
/// see the same criteria scored across successive revisions.
/// </summary>
[ApiController]
[Route("api/essays")]
[Authorize]
[Produces("application/json")]
public partial class EssaysController : ControllerBase
{
    private readonly IMediator _mediator;

    public EssaysController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record SaveRubricRequest(
        Guid? RubricId, string Name, string? Description, List<RubricCriterionDto> Criteria);

    public record SaveEssayRequest(
        Guid? RubricId, Guid? ParentSubmissionId, string Title, string? PromptText, string Text);

    // ── Rubrics ─────────────────────────────────────────────────────────────

    [HttpGet("rubrics")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<RubricDto>>), 200)]
    public async Task<IActionResult> GetRubrics(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetRubricsQuery(User.GetUserId()), cancellationToken);
        return Ok(BaseResponse<IEnumerable<RubricDto>>.Ok(result.Data!));
    }

    /// <summary>Creates a rubric, or replaces one when RubricId is supplied.</summary>
    [HttpPost("rubrics")]
    [ProducesResponseType(typeof(BaseResponse<RubricDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SaveRubric(
        [FromBody] SaveRubricRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new SaveRubricCommand(
            User.GetUserId(), request.RubricId, request.Name, request.Description, request.Criteria),
            cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<RubricDto>.Ok(result.Data!, result.Message))
            : BadRequest(BaseResponse<RubricDto>.Fail(result.Message, result.ErrorCode));
    }

    [HttpDelete("rubrics/{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteRubric(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new DeleteRubricCommand(User.GetUserId(), id), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<bool>.Ok(result.Data, result.Message))
            : NotFound(BaseResponse<bool>.Fail(result.Message, result.ErrorCode));
    }

    // ── Drafts ──────────────────────────────────────────────────────────────

    /// <summary>Latest draft of each essay.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<EssaySubmissionDto>>), 200)]
    public async Task<IActionResult> GetEssays(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetEssaysQuery(User.GetUserId()), cancellationToken);
        return Ok(BaseResponse<IEnumerable<EssaySubmissionDto>>.Ok(result.Data!));
    }

    /// <summary>Every draft in one revision chain, oldest first.</summary>
    [HttpGet("{id:guid}/revisions")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<EssaySubmissionDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetRevisions(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetEssayChainQuery(User.GetUserId(), id), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<IEnumerable<EssaySubmissionDto>>.Ok(result.Data!))
            : NotFound(BaseResponse<IEnumerable<EssaySubmissionDto>>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>
    /// Saves a draft. Pass ParentSubmissionId to record it as a revision rather than a new essay.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<EssaySubmissionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SaveEssay(
        [FromBody] SaveEssayRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new SaveEssayCommand(
            User.GetUserId(), request.RubricId, request.ParentSubmissionId,
            request.Title, request.PromptText, request.Text), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<EssaySubmissionDto>.Ok(result.Data!, result.Message))
            : BadRequest(BaseResponse<EssaySubmissionDto>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>Marks a draft against its rubric.</summary>
    [HttpPost("{id:guid}/grade")]
    [ProducesResponseType(typeof(BaseResponse<EssaySubmissionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> Grade(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GradeEssayCommand(User.GetUserId(), id), cancellationToken);

        if (result.IsSuccess)
            return Ok(BaseResponse<EssaySubmissionDto>.Ok(result.Data!, result.Message));

        return result.ErrorCode == "NOT_FOUND"
            ? NotFound(BaseResponse<EssaySubmissionDto>.Fail(result.Message, result.ErrorCode))
            : BadRequest(BaseResponse<EssaySubmissionDto>.Fail(result.Message, result.ErrorCode));
    }
}
