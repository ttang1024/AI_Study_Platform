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

    [HttpPatch("{quizId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<QuestionBankQuestionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateQuestion(Guid quizId, [FromBody] UpdateQuestionBankQuestionRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateQuestionBankQuestionCommand(
            userId,
            quizId,
            request.Question,
            request.Options,
            request.CorrectAnswer,
            request.Explanation,
            request.Difficulty));

        if (!result.IsSuccess)
            return result.ErrorCode == "QUESTION_NOT_FOUND"
                ? NotFound(BaseResponse<QuestionBankQuestionDto>.Fail(result.Message, result.ErrorCode))
                : BadRequest(BaseResponse<QuestionBankQuestionDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<QuestionBankQuestionDto>.Ok(result.Data!, result.Message));
    }

    [HttpDelete("{quizId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteQuestion(Guid quizId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteQuestionBankQuestionCommand(userId, quizId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
