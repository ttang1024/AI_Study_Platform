using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.LibraryTags.Commands;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Application.LibraryTags.Queries;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Tags, collections, and saved views over the library. Tags and collections share one endpoint set
/// and are told apart by <c>kind</c>, matching how they are stored.
/// </summary>
[ApiController]
[Route("api/library/tags")]
[Authorize]
[Produces("application/json")]
public class LibraryTagsController : ControllerBase
{
    private readonly IMediator _mediator;

    public LibraryTagsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <param name="kind">tag | collection. Omit for both.</param>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<LibraryTagDto>>), 200)]
    public async Task<IActionResult> GetTags([FromQuery] string? kind = null)
    {
        var result = await _mediator.Send(new GetLibraryTagsQuery(User.GetUserId(), kind));
        return Ok(BaseResponse<IReadOnlyList<LibraryTagDto>>.Ok(result.Data!, result.Message));
    }

    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<LibraryTagDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateTag([FromBody] CreateLibraryTagRequest request)
    {
        var result = await _mediator.Send(new CreateLibraryTagCommand(
            User.GetUserId(), request.Name, request.Kind, request.Color, request.Description));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<LibraryTagDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return CreatedAtAction(nameof(GetTags), BaseResponse<LibraryTagDto>.Ok(result.Data!, result.Message));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<LibraryTagDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> UpdateTag(Guid id, [FromBody] UpdateLibraryTagRequest request)
    {
        var result = await _mediator.Send(new UpdateLibraryTagCommand(
            User.GetUserId(), id, request.Name, request.Color, request.Description));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<LibraryTagDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<LibraryTagDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteTag(Guid id)
    {
        var result = await _mediator.Send(new DeleteLibraryTagCommand(User.GetUserId(), id));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>Adds a tag to many items at once — the multi-select action in the library.</summary>
    [HttpPost("{id:guid}/items")]
    [ProducesResponseType(typeof(BaseResponse<BulkTagResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> AssignItems(Guid id, [FromBody] AssignLibraryTagRequest request)
        => await AssignAsync(id, request, assign: true);

    /// <summary>Removes a tag from many items at once. The items themselves are untouched.</summary>
    [HttpDelete("{id:guid}/items")]
    [ProducesResponseType(typeof(BaseResponse<BulkTagResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> UnassignItems(Guid id, [FromBody] AssignLibraryTagRequest request)
        => await AssignAsync(id, request, assign: false);

    private async Task<IActionResult> AssignAsync(Guid id, AssignLibraryTagRequest request, bool assign)
    {
        var result = await _mediator.Send(new AssignLibraryTagCommand(
            User.GetUserId(), id, request.Items ?? Array.Empty<LibraryItemRef>(), assign));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<BulkTagResultDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<BulkTagResultDto>.Ok(result.Data!, result.Message));
    }
}

/// <summary>Saved library filters — "smart folders" that re-run rather than store their matches.</summary>
[ApiController]
[Route("api/library/views")]
[Authorize]
[Produces("application/json")]
public class LibraryViewsController : ControllerBase
{
    private readonly IMediator _mediator;

    public LibraryViewsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<SavedLibraryViewDto>>), 200)]
    public async Task<IActionResult> GetViews()
    {
        var result = await _mediator.Send(new GetLibraryViewsQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<SavedLibraryViewDto>>.Ok(result.Data!, result.Message));
    }

    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<SavedLibraryViewDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateView([FromBody] SaveLibraryViewRequest request)
    {
        var result = await _mediator.Send(new SaveLibraryViewCommand(
            User.GetUserId(), null, request.Name, request.Icon, request.FiltersJson, request.Position));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<SavedLibraryViewDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<SavedLibraryViewDto>.Ok(result.Data!, result.Message));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<SavedLibraryViewDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> UpdateView(Guid id, [FromBody] SaveLibraryViewRequest request)
    {
        var result = await _mediator.Send(new SaveLibraryViewCommand(
            User.GetUserId(), id, request.Name, request.Icon, request.FiltersJson, request.Position));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<SavedLibraryViewDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<SavedLibraryViewDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteView(Guid id)
    {
        var result = await _mediator.Send(new DeleteLibraryViewCommand(User.GetUserId(), id));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
