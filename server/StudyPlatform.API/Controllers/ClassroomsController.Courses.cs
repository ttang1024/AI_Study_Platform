using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// Assigning courses from an instructor's own library into a classroom.
public partial class ClassroomsController
{
    public record AssignCourseRequest(Guid CourseId, DateTime? DueAt);

    /// <summary>
    /// Assign one of the caller's own courses to the classroom, optionally with a due date.
    /// Re-assigning an already-assigned course updates its due date instead of erroring.
    /// </summary>
    [HttpPost("{id:guid}/courses")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomCourseDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> AssignCourse(Guid id, [FromBody] AssignCourseRequest request)
    {
        var result = await _mediator.Send(
            new AssignCourseToClassroomCommand(User.GetUserId(), id, request.CourseId, request.DueAt));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomCourseDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomCourseDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Remove a course assignment from the classroom.</summary>
    [HttpDelete("{id:guid}/courses/{classroomCourseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> UnassignCourse(Guid id, Guid classroomCourseId)
    {
        var result = await _mediator.Send(new UnassignCourseCommand(User.GetUserId(), id, classroomCourseId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }
}
