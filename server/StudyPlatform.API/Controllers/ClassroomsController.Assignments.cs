using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// The hand-in loop. Like .Gradebook these actions cross the per-user scoping rule, so every one of
// them resolves the caller's classroom role in its handler — the route shape grants nothing.
public partial class ClassroomsController
{
    public record SaveAssignmentRequest(
        string Title,
        string? Instructions,
        Guid? CourseId,
        double PointsPossible,
        DateTime? DueAt,
        bool AllowLateSubmissions,
        bool Publish);

    /// <summary>Text is the student's answer; submit=false saves a private draft instead of handing in.</summary>
    public record SaveSubmissionRequest(string Text, bool Submit);

    /// <summary>A null score clears the grade and returns the work to the student for editing.</summary>
    public record GradeSubmissionRequest(double? PointsAwarded, string? Feedback);

    /// <summary>
    /// Assignments in the classroom. Students see published ones with their own status; teaching
    /// staff also see drafts, plus submitted/graded counts.
    /// </summary>
    [HttpGet("{id:guid}/assignments")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ClassroomAssignmentDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetAssignments(Guid id)
    {
        var result = await _mediator.Send(new GetClassroomAssignmentsQuery(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<IEnumerable<ClassroomAssignmentDto>>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<IEnumerable<ClassroomAssignmentDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// One assignment. A student gets only their own submission back; staff get a row per student on
    /// the roster, including those who have not started.
    /// </summary>
    [HttpGet("{id:guid}/assignments/{assignmentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomAssignmentDetailDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetAssignment(Guid id, Guid assignmentId)
    {
        var result = await _mediator.Send(
            new GetClassroomAssignmentDetailQuery(User.GetUserId(), id, assignmentId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomAssignmentDetailDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomAssignmentDetailDto>.Ok(result.Data!));
    }

    /// <summary>Creates an assignment. Instructors only; publish=false leaves it a draft.</summary>
    [HttpPost("{id:guid}/assignments")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomAssignmentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> CreateAssignment(Guid id, [FromBody] SaveAssignmentRequest request)
    {
        var result = await _mediator.Send(new CreateClassroomAssignmentCommand(
            User.GetUserId(), id, request.Title, request.Instructions, request.CourseId,
            request.PointsPossible, request.DueAt, request.AllowLateSubmissions, request.Publish));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomAssignmentDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomAssignmentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Edits an assignment. Instructors only.</summary>
    [HttpPut("{id:guid}/assignments/{assignmentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomAssignmentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateAssignment(
        Guid id, Guid assignmentId, [FromBody] SaveAssignmentRequest request)
    {
        var result = await _mediator.Send(new UpdateClassroomAssignmentCommand(
            User.GetUserId(), id, assignmentId, request.Title, request.Instructions, request.CourseId,
            request.PointsPossible, request.DueAt, request.AllowLateSubmissions, request.Publish));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomAssignmentDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomAssignmentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Deletes an assignment. Refused once anything has been handed in.</summary>
    [HttpDelete("{id:guid}/assignments/{assignmentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteAssignment(Guid id, Guid assignmentId)
    {
        var result = await _mediator.Send(
            new DeleteClassroomAssignmentCommand(User.GetUserId(), id, assignmentId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }

    /// <summary>
    /// Saves the caller's own submission — draft or hand-in. There is deliberately no route to write
    /// anyone else's.
    /// </summary>
    [HttpPut("{id:guid}/assignments/{assignmentId:guid}/submission")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomSubmissionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> SaveSubmission(
        Guid id, Guid assignmentId, [FromBody] SaveSubmissionRequest request)
    {
        var result = await _mediator.Send(new SaveClassroomSubmissionCommand(
            User.GetUserId(), id, assignmentId, request.Text, request.Submit));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomSubmissionDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomSubmissionDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Scores one student's submission. Instructors and assistants only.</summary>
    [HttpPut("{id:guid}/assignments/{assignmentId:guid}/submissions/{studentUserId:guid}/grade")]
    [ProducesResponseType(typeof(BaseResponse<ClassroomSubmissionDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GradeSubmission(
        Guid id, Guid assignmentId, Guid studentUserId, [FromBody] GradeSubmissionRequest request)
    {
        var result = await _mediator.Send(new GradeClassroomSubmissionCommand(
            User.GetUserId(), id, assignmentId, studentUserId, request.PointsAwarded, request.Feedback));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<ClassroomSubmissionDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<ClassroomSubmissionDto>.Ok(result.Data!, result.Message));
    }
}
