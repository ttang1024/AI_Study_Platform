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
