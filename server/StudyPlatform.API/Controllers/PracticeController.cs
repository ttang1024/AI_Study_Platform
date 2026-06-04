using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Practice.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/practice")]
[Authorize]
[Produces("application/json")]
public class PracticeController : ControllerBase
{
    private readonly IMediator _mediator;

    public PracticeController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Generate a timed, mixed-source practice test sampled from the quiz bank, flashcards,
    /// glossary, and worked problems. Optionally filter by course and source types.
    /// </summary>
    [HttpGet("generate")]
    [ProducesResponseType(typeof(BaseResponse<PracticeTestDto>), 200)]
    public async Task<IActionResult> Generate(
        [FromQuery] int count = 15,
        [FromQuery] Guid? courseId = null,
        [FromQuery] string? sources = null)
    {
        var userId = User.GetUserId();
        var sourceList = string.IsNullOrWhiteSpace(sources)
            ? Array.Empty<string>()
            : sources.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var result = await _mediator.Send(new GeneratePracticeTestQuery(userId, count, courseId, sourceList));
        return Ok(BaseResponse<PracticeTestDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Submit practice-test results. Feeds existing mastery signals: quiz-accuracy analytics,
    /// FSRS reviews for flashcards, and mastered flags for correctly-answered terms/problems.
    /// </summary>
    [HttpPost("submit")]
    [ProducesResponseType(typeof(BaseResponse<PracticeTestSummaryDto>), 200)]
    public async Task<IActionResult> Submit([FromBody] SubmitPracticeTestRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SubmitPracticeTestCommand(userId, request.Results));
        return Ok(BaseResponse<PracticeTestSummaryDto>.Ok(result.Data!));
    }
}
