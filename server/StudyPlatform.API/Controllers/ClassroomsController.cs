using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// Classrooms feature. Actions are split by concern across partial-class files:
//   (this file) — classroom lifecycle: list, create, detail, join, archive
//   .Roster     — enrollment roles and removal
//   .Courses    — assigning courses to a classroom
//   .Assignments— set work, hand it in, grade it back
//   .Gradebook  — instructor views over student work
[ApiController]
[Route("api/classrooms")]
[Authorize]
[Produces("application/json")]
public partial class ClassroomsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ClassroomsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record CreateClassroomRequest(Guid OrganizationId, string Name, string? Description);
    public record JoinClassroomRequest(string JoinCode);
    public record ArchiveClassroomRequest(bool Archived);
    public record SetEnrollmentOpenRequest(bool Open);

    /// <summary>Classrooms the caller is enrolled in, as student or instructor.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ClassroomDto>>), 200)]
    public async Task<IActionResult> GetMyClassrooms()
    {
        var result = await _mediator.Send(new GetMyClassroomsQuery(User.GetUserId()));
        return Ok(BaseResponse<IEnumerable<ClassroomDto>>.Ok(result.Data!));
    }

    /// <summary>Create a classroom inside an organization. Requires an instructor role there.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<ClassroomDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> CreateClassroom([FromBody] CreateClassroomRequest request)
    {
        var result = await _mediator.Send(new CreateClassroomCommand(
            User.GetUserId(), request.OrganizationId, request.Name, request.Description));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomDto>(result.Message, result.ErrorCode);

        return CreatedAtAction(nameof(GetClassroomDetail), new { id = result.Data!.ClassroomId },
            BaseResponse<ClassroomDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Classroom detail. Instructors get the full roster; students get the teaching staff plus
    /// their own enrollment.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomDetailDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetClassroomDetail(Guid id)
    {
        var result = await _mediator.Send(new GetClassroomDetailQuery(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomDetailDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomDetailDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Classwork the caller still owes, across every classroom they are a student in, soonest first.
    /// Overdue assignments are included; work already handed in is not.
    /// </summary>
    [HttpGet("deadlines")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<ClassroomDeadlineDto>>), 200)]
    public async Task<IActionResult> GetDeadlines([FromQuery] int days = 14)
    {
        var result = await _mediator.Send(
            new GetClassroomDeadlinesQuery(User.GetUserId(), Math.Clamp(days, 1, 90)));

        return Ok(BaseResponse<IReadOnlyList<ClassroomDeadlineDto>>.Ok(result.Data!));
    }

    /// <summary>Enroll in a classroom using its join code.</summary>
    [HttpPost("join")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> JoinClassroom([FromBody] JoinClassroomRequest request)
    {
        var result = await _mediator.Send(new JoinClassroomCommand(User.GetUserId(), request.JoinCode));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Issue a new join code, invalidating the old one. Instructor only. Students already enrolled
    /// are unaffected — the code only ever gates joining.
    /// </summary>
    [HttpPost("{id:guid}/join-code/rotate")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> RotateJoinCode(Guid id)
    {
        var result = await _mediator.Send(new RotateJoinCodeCommand(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<string>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<string>.Ok(result.Data!, result.Message));
    }

    /// <summary>Open or close self-enrollment, without changing the code itself. Instructor only.</summary>
    [HttpPut("{id:guid}/enrollment")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> SetEnrollmentOpen(Guid id, [FromBody] SetEnrollmentOpenRequest request)
    {
        var result = await _mediator.Send(new SetEnrollmentOpenCommand(User.GetUserId(), id, request.Open));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }

    /// <summary>Archive or restore a classroom. Archived classrooms keep their gradebook.</summary>
    [HttpPut("{id:guid}/archive")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> ArchiveClassroom(Guid id, [FromBody] ArchiveClassroomRequest request)
    {
        var result = await _mediator.Send(new ArchiveClassroomCommand(User.GetUserId(), id, request.Archived));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }
}
