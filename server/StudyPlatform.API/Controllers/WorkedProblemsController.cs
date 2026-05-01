using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.WorkedProblems.Commands;
using StudyPlatform.Application.WorkedProblems.DTOs;
using StudyPlatform.Application.WorkedProblems.Queries;

namespace StudyPlatform.API.Controllers;

public record GenerateWorkedProblemsRequest(string Difficulty = "medium", int Count = 5);
public record SubmitAttemptRequest(string UserAnswer);

[ApiController]
[Authorize]
[Produces("application/json")]
public class WorkedProblemsController : ControllerBase
{
    private readonly IMediator _mediator;

    public WorkedProblemsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get worked problems for a document
    /// </summary>
    [HttpGet("api/documents/{documentId:guid}/worked-problems")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemDto>>), 200)]
    public async Task<IActionResult> GetWorkedProblems(Guid documentId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetWorkedProblemsQuery(userId, documentId, null), cancellationToken);
        return Ok(BaseResponse<IEnumerable<WorkedProblemDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Generate worked problems for a document
    /// </summary>
    [HttpPost("api/documents/{documentId:guid}/worked-problems/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GenerateWorkedProblems(Guid documentId, [FromBody] GenerateWorkedProblemsRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new GenerateWorkedProblemsCommand(userId, documentId, null, request.Difficulty, request.Count),
            cancellationToken);
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<IEnumerable<WorkedProblemDto>>.Fail(result.Message, result.ErrorCode));
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<WorkedProblemDto>>(this, result.Message);
            return BadRequest(BaseResponse<IEnumerable<WorkedProblemDto>>.Fail(result.Message, result.ErrorCode));
        }
        return Ok(BaseResponse<IEnumerable<WorkedProblemDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Submit an attempt for a worked problem
    /// </summary>
    [HttpPost("api/worked-problems/{id:guid}/attempt")]
    [ProducesResponseType(typeof(BaseResponse<WorkedProblemAttemptDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> SubmitAttempt(Guid id, [FromBody] SubmitAttemptRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SubmitProblemAttemptCommand(userId, id, request.UserAnswer), cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<WorkedProblemAttemptDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<WorkedProblemAttemptDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get attempts for a worked problem
    /// </summary>
    [HttpGet("api/worked-problems/{id:guid}/attempts")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemAttemptDto>>), 200)]
    public async Task<IActionResult> GetAttempts(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetProblemAttemptsQuery(userId, id), cancellationToken);
        return Ok(BaseResponse<IEnumerable<WorkedProblemAttemptDto>>.Ok(result.Data!));
    }
}
