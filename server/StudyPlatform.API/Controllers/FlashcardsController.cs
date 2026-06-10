using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Flashcards.DTOs;

namespace StudyPlatform.API.Controllers;

public record ImportFlashcardsRequest(List<ImportFlashcardRow> Rows);

[ApiController]
[Route("api/flashcards")]
[Authorize]
[Produces("application/json")]
public class FlashcardsController : ControllerBase
{
    private readonly IMediator _mediator;

    public FlashcardsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get all flashcards for the authenticated user (paginated)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<FlashcardDto>>), 200)]
    public async Task<IActionResult> GetAllFlashcards([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllFlashcardsPagedQuery(userId, page, pageSize));
        return Ok(BaseResponse<PaginatedList<FlashcardDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get source IDs that already have generated flashcards for the authenticated user
    /// </summary>
    [HttpGet("coverage")]
    [ProducesResponseType(typeof(BaseResponse<FlashcardCoverageDto>), 200)]
    public async Task<IActionResult> GetCoverage()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetFlashcardCoverageQuery(userId));
        return Ok(BaseResponse<FlashcardCoverageDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get materials that do not yet have generated flashcards for the authenticated user
    /// </summary>
    [HttpGet("pending-materials")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<PendingMaterialDto>>), 200)]
    public async Task<IActionResult> GetPendingMaterials()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetPendingFlashcardMaterialsQuery(userId));
        return Ok(BaseResponse<IEnumerable<PendingMaterialDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a new flashcard
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<FlashcardDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateFlashcard([FromBody] CreateFlashcardRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateFlashcardCommand(userId, request.Front, request.Back, request.DocumentId, CardType: request.CardType));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<FlashcardDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetAllFlashcards), BaseResponse<FlashcardDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Bulk-import flashcards (e.g. parsed from an Anki TSV/CSV export)
    /// </summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(BaseResponse<ImportFlashcardsResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ImportFlashcards([FromBody] ImportFlashcardsRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ImportFlashcardsCommand(userId, request.Rows));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ImportFlashcardsResultDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ImportFlashcardsResultDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a flashcard
    /// </summary>
    [HttpDelete("{flashcardId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteFlashcard(Guid flashcardId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteFlashcardCommand(flashcardId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Bulk delete flashcards
    /// </summary>
    [HttpDelete("bulk")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    public async Task<IActionResult> BulkDeleteFlashcards([FromBody] BulkDeleteFlashcardsRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new BulkDeleteFlashcardsCommand(request.FlashcardIds, userId));
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Submit an FSRS review for a flashcard (1=Again, 2=Hard, 3=Good, 4=Easy)
    /// </summary>
    [HttpPost("{flashcardId:guid}/review")]
    [ProducesResponseType(typeof(BaseResponse<ReviewFlashcardResponse>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ReviewFlashcard(Guid flashcardId, [FromBody] ReviewFlashcardRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ReviewFlashcardCommand(flashcardId, userId, request.Rating));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ReviewFlashcardResponse>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ReviewFlashcardResponse>.Ok(result.Data!));
    }

    /// <summary>
    /// Get FSRS state for all flashcards of the authenticated user
    /// </summary>
    [HttpGet("srs")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<FlashcardSrsDto>>), 200)]
    public async Task<IActionResult> GetSrsStates()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetFlashcardSrsQuery(userId));
        return Ok(BaseResponse<IEnumerable<FlashcardSrsDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Update classification (difficulty, chapter, tags) for a flashcard
    /// </summary>
    [HttpPatch("{flashcardId:guid}/classify")]
    [ProducesResponseType(typeof(BaseResponse<FlashcardDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> ClassifyFlashcard(Guid flashcardId, [FromBody] ClassifyFlashcardRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new ClassifyFlashcardCommand(flashcardId, userId, request.Front, request.Back, request.Difficulty, request.Chapter, request.Tags));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<FlashcardDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<FlashcardDto>.Ok(result.Data!));
    }

}
