using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.QuestionBank;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/question-bank")]
[Authorize]
[Produces("application/json")]
public class QuestionBankController : ControllerBase
{
    private readonly IMediator _mediator;

    public QuestionBankController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<QuestionBankQuestionDto>>), 200)]
    public async Task<IActionResult> GetQuestions(
        [FromQuery] Guid? courseId = null,
        [FromQuery] string? sourceType = null,
        [FromQuery] string? difficulty = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetQuestionBankQuery(userId, courseId, sourceType, difficulty));
        return Ok(BaseResponse<IEnumerable<QuestionBankQuestionDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Record a single answer attempt on a question-bank question. Wrong answers land in the
    /// mistake notebook (or bump an existing entry); correct answers resolve an open entry.
    /// </summary>
    [HttpPost("{quizId:guid}/attempt")]
    [ProducesResponseType(typeof(BaseResponse<QuestionBankAttemptResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RecordAttempt(Guid quizId, [FromBody] RecordQuestionBankAttemptRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RecordQuestionBankAttemptCommand(userId, quizId, request.SelectedAnswer));

        if (!result.IsSuccess)
            return result.ErrorCode == "QUESTION_NOT_FOUND"
                ? NotFound(BaseResponse<QuestionBankAttemptResultDto>.Fail(result.Message, result.ErrorCode))
                : BadRequest(BaseResponse<QuestionBankAttemptResultDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<QuestionBankAttemptResultDto>.Ok(result.Data!));
    }

}
