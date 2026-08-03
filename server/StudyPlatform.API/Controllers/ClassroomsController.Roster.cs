using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// Roster management: enrollment roles and removal.
public partial class ClassroomsController
{
    public record SetRoleRequest(string Role);
    public record AddMemberRequest(string Email, string Role);

    /// <summary>
    /// Enroll someone directly by email, without a join code. Instructor only. Re-adding a student
    /// who was removed restores their original enrollment, and with it their gradebook history.
    /// </summary>
    [HttpPost("{id:guid}/roster")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomRosterEntryDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        var result = await _mediator.Send(
            new AddClassroomMemberCommand(User.GetUserId(), id, request.Email, request.Role));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomRosterEntryDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomRosterEntryDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Change a member's role within the classroom. Instructor only.</summary>
    [HttpPut("{id:guid}/roster/{userId:guid}/role")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> SetEnrollmentRole(Guid id, Guid userId, [FromBody] SetRoleRequest request)
    {
        var result = await _mediator.Send(
            new SetEnrollmentRoleCommand(User.GetUserId(), id, userId, request.Role));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }

    /// <summary>
    /// Remove a member. Instructors can remove anyone; a student passing their own id leaves the
    /// classroom. The enrollment is soft-removed so past submissions stay attributable.
    /// </summary>
    [HttpDelete("{id:guid}/roster/{userId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> RemoveEnrollment(Guid id, Guid userId)
    {
        var result = await _mediator.Send(new RemoveEnrollmentCommand(User.GetUserId(), id, userId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }
}
