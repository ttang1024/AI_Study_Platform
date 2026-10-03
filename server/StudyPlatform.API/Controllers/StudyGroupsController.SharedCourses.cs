using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Sharing courses into a study group and removing them.
public partial class StudyGroupsController
{
    /// <summary>
    /// Share a course with a study group
    /// </summary>
    [HttpPost("{id:guid}/share-course")]
    [ProducesResponseType(typeof(BaseResponse<SharedCourseDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ShareCourseWithGroup(Guid id, [FromBody] ShareCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new ShareCourseWithGroupCommand(userId, id, request.CourseId));

        if (!result.IsSuccess)
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        await _hubContext.Clients.Group(id.ToString()).SendAsync("CourseShared", result.Data!);

        return Ok(BaseResponse<SharedCourseDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Remove a shared course from a study group
    /// </summary>
    [HttpDelete("{id:guid}/shared-courses/{courseId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RemoveSharedCourse(Guid id, Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new RemoveSharedCourseCommand(userId, id, courseId));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "NOT_FOUND")
                return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
            return BadRequest(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });
        }

        await _hubContext.Clients.Group(id.ToString()).SendAsync("CourseUnshared", courseId);

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }
}

public record ShareCourseRequest(Guid CourseId);
