using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Annotations;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
public class AnnotationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AnnotationsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Create an annotation on a document
    /// </summary>
    [HttpPost("api/documents/{documentId:guid}/annotations")]
    [ProducesResponseType(typeof(BaseResponse<DocumentAnnotationDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateAnnotation(Guid documentId, [FromBody] CreateAnnotationRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateAnnotationCommand(
            userId, documentId, request.HighlightedText, request.Note, request.Color, request.PageNumber, request.RectJson));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentAnnotationDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetAnnotations), new { documentId },
            BaseResponse<DocumentAnnotationDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get all annotations for a document
    /// </summary>
    [HttpGet("api/documents/{documentId:guid}/annotations")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<DocumentAnnotationDto>>), 200)]
    public async Task<IActionResult> GetAnnotations(Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAnnotationsByDocumentQuery(userId, documentId));
        return Ok(BaseResponse<IEnumerable<DocumentAnnotationDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Update an annotation's note or color
    /// </summary>
    [HttpPut("api/annotations/{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentAnnotationDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateAnnotation(Guid id, [FromBody] UpdateAnnotationRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateAnnotationCommand(userId, id, request.Note, request.Color));

        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentAnnotationDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentAnnotationDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Delete an annotation
    /// </summary>
    [HttpDelete("api/annotations/{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteAnnotation(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteAnnotationCommand(userId, id));

        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Create a flashcard from an annotation using AI
    /// </summary>
    [HttpPost("api/annotations/{id:guid}/create-flashcard")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> CreateFlashcardFromAnnotation(Guid id)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateFlashcardFromAnnotationCommand(userId, id));

        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record CreateAnnotationRequest(
    string HighlightedText,
    string? Note,
    string Color,
    int PageNumber,
    string RectJson);

public record UpdateAnnotationRequest(string? Note, string Color);
