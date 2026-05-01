using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Courses.Commands;
using StudyPlatform.Application.Courses.DTOs;
using StudyPlatform.Application.Courses.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/courses")]
[Authorize]
[Produces("application/json")]
public class CoursesController : ControllerBase
{
    private readonly IMediator _mediator;

    public CoursesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Get all courses for the authenticated user
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<CourseDto>>), 200)]
    public async Task<IActionResult> GetAllCourses()
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllCoursesQuery(userId));
        return Ok(BaseResponse<IEnumerable<CourseDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get a course by ID
    /// </summary>
    [HttpGet("{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<CourseDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetCourseById(Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetCourseByIdQuery(courseId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<CourseDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<CourseDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a new course
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<CourseDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreateCourseCommand(userId, request.CourseName, request.CourseColor));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<CourseDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetCourseById), new { courseId = result.Data!.CourseId },
            BaseResponse<CourseDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Update an existing course
    /// </summary>
    [HttpPut("{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<CourseDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateCourse(Guid courseId, [FromBody] UpdateCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateCourseCommand(courseId, userId, request.CourseName, request.CourseColor));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<CourseDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<CourseDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a course
    /// </summary>
    [HttpDelete("{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteCourse(Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteCourseCommand(courseId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}
