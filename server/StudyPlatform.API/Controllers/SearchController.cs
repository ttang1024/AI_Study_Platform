using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Search.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/search")]
[Authorize]
[Produces("application/json")]
public class SearchController : ControllerBase
{
    private readonly IMediator _mediator;

    public SearchController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Global full-text search across documents, notes, flashcards, and glossary
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<SearchResultsDto>), 200)]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string[]? types,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new GlobalSearchQuery(userId, q ?? string.Empty, types, page, pageSize),
            cancellationToken);
        return Ok(BaseResponse<SearchResultsDto>.Ok(result.Data!));
    }
}
