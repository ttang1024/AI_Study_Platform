using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Courses;
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
