using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Mistakes;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/mistakes")]
[Authorize]
[Produces("application/json")]
public class MistakesController : ControllerBase
{
    private readonly IMediator _mediator;

    public MistakesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get the user's mistake notebook (wrong quiz answers, auto-collected on submission).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<MistakesDto>), 200)]
    public async Task<IActionResult> GetMistakes([FromQuery] string? status = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetMistakesQuery(userId, status));
        return Ok(BaseResponse<MistakesDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Mark a mistake as resolved or reopen it ("open" | "resolved").
    /// </summary>
    [HttpPost("{mistakeId:guid}/status")]
    [ProducesResponseType(typeof(BaseResponse<MistakeDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> SetStatus(Guid mistakeId, [FromBody] SetMistakeStatusRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SetMistakeStatusCommand(mistakeId, userId, request.Status));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<MistakeDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<MistakeDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a mistake entry.
    /// </summary>
    [HttpDelete("{mistakeId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> Delete(Guid mistakeId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteMistakeCommand(mistakeId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Generate AI practice variants testing the same concept as the missed question.
    /// </summary>
    [HttpPost("{mistakeId:guid}/variants")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<VariantQuestionDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GenerateVariants(Guid mistakeId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GenerateMistakeVariantsCommand(mistakeId, userId), cancellationToken);
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<IReadOnlyList<VariantQuestionDto>>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<IReadOnlyList<VariantQuestionDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Promote missed questions into flashcards that are due for review immediately. Send no ids to
    /// promote every open mistake. Mistakes that already have a card are skipped, not duplicated.
    /// </summary>
    [HttpPost("to-flashcards")]
    [ProducesResponseType(typeof(BaseResponse<PromotedMistakesDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> PromoteToFlashcards(
        [FromBody] PromoteMistakesRequest? request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new PromoteMistakesToFlashcardsCommand(userId, request?.MistakeIds ?? []), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<PromotedMistakesDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<PromotedMistakesDto>.Ok(result.Data!, result.Message));
    }
}

public record SetMistakeStatusRequest(string Status);

/// <summary>Empty or absent <see cref="MistakeIds"/> promotes every open mistake.</summary>
public record PromoteMistakesRequest(IReadOnlyCollection<Guid>? MistakeIds);
