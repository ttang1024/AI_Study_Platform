using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Planner;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/planner")]
[Authorize]
[Produces("application/json")]
public class PlannerController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlannerController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>List the user's exam plans (soonest exam first).</summary>
    [HttpGet("exam-plans")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<ExamPlanDto>>), 200)]
    public async Task<IActionResult> GetExamPlans()
    {
        var result = await _mediator.Send(new GetExamPlansQuery(User.GetUserId()));
        return Ok(BaseResponse<IReadOnlyList<ExamPlanDto>>.Ok(result.Data!));
    }

    /// <summary>Create an exam plan.</summary>
    [HttpPost("exam-plans")]
    [ProducesResponseType(typeof(BaseResponse<ExamPlanDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateExamPlan([FromBody] CreateExamPlanRequest request)
    {
        var result = await _mediator.Send(new CreateExamPlanCommand(
            User.GetUserId(), request.Title, request.ExamDate, request.CourseId, request.DailyMinutes));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ExamPlanDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ExamPlanDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Delete an exam plan.</summary>
    [HttpDelete("exam-plans/{planId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteExamPlan(Guid planId)
    {
        var result = await _mediator.Send(new DeleteExamPlanCommand(planId, User.GetUserId()));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// AI cram sheet for an exam plan: a one-page Markdown summary of the learner's
    /// weak material (open mistakes + unmastered terms). Cached daily; refresh=true regenerates.
    /// </summary>
    [HttpGet("exam-plans/{planId:guid}/cram-sheet")]
    [ProducesResponseType(typeof(BaseResponse<CramSheetDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetCramSheet(Guid planId, [FromQuery] bool refresh = false)
    {
        var result = await _mediator.Send(new GetCramSheetQuery(User.GetUserId(), planId, refresh));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<CramSheetDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<CramSheetDto>.Ok(result.Data!));
    }

    /// <summary>Get the back-planned daily schedule for an exam plan.</summary>
    [HttpGet("exam-plans/{planId:guid}/schedule")]
    [ProducesResponseType(typeof(BaseResponse<ExamScheduleDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetSchedule(Guid planId)
    {
        var result = await _mediator.Send(new GetExamScheduleQuery(planId, User.GetUserId()));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<ExamScheduleDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ExamScheduleDto>.Ok(result.Data!));
    }

    /// <summary>Assemble a timed mock exam from the user's quiz bank (correct answers stay server-side).</summary>
    [HttpGet("mock-exam")]
    [ProducesResponseType(typeof(BaseResponse<MockExamDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GetMockExam([FromQuery] Guid? courseId = null, [FromQuery] int count = 10)
    {
        var result = await _mediator.Send(new GetMockExamQuery(User.GetUserId(), courseId, count));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<MockExamDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<MockExamDto>.Ok(result.Data!));
    }

    /// <summary>Grade a mock exam; wrong answers are captured into the mistake notebook.</summary>
    [HttpPost("mock-exam/grade")]
    [ProducesResponseType(typeof(BaseResponse<MockExamResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GradeMockExam([FromBody] GradeMockExamRequest request)
    {
        var result = await _mediator.Send(new GradeMockExamCommand(User.GetUserId(), request.Answers, request.DurationSeconds));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<MockExamResultDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<MockExamResultDto>.Ok(result.Data!));
    }
}
