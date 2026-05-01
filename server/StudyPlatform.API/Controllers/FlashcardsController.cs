using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Flashcards.DTOs;

namespace StudyPlatform.API.Controllers;

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
        var result = await _mediator.Send(new CreateFlashcardCommand(userId, request.Front, request.Back, request.DocumentId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<FlashcardDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetAllFlashcards), BaseResponse<FlashcardDto>.Ok(result.Data!, result.Message));
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

}
