using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Library.DTOs;
using StudyPlatform.Application.Library.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/library")]
[Authorize]
[Produces("application/json")]
public class LibraryController : ControllerBase
{
    private readonly IMediator _mediator;

    public LibraryController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// One page of the unified library — documents and videos merged and sorted by
    /// date, filtered by type/course/search. Replaces the old "fetch every document
    /// and every video, then paginate in the browser" approach.
    /// </summary>
    /// <param name="tagIds">
    /// Repeatable. Keeps items carrying at least one of the given tags or collections.
    /// </param>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<LibraryItemDto>>), 200)]
    public async Task<IActionResult> GetLibrary(
        [FromQuery] string type = "all",
        [FromQuery] Guid? courseId = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 8,
        [FromQuery] Guid[]? tagIds = null,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new GetLibraryQuery(userId, type, courseId, search, page, pageSize, tagIds),
            cancellationToken);
        return Ok(BaseResponse<PaginatedList<LibraryItemDto>>.Ok(result.Data!));
    }
}
