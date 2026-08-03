using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// Instructor views over student work. These are the only endpoints outside Admin that return rows
// belonging to other users; both go through a grader-role check in their handler.
public partial class ClassroomsController
{
    /// <summary>
    /// Roster × assigned-course grid of scores, attempts and time-on-task. Instructors and
    /// assistants only.
    /// </summary>
    [HttpGet("{id:guid}/gradebook")]
    [ProducesResponseType(typeof(BaseResponse<GradebookDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetGradebook(Guid id)
    {
        var result = await _mediator.Send(new GetGradebookQuery(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<GradebookDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<GradebookDto>.Ok(result.Data!));
    }

    /// <summary>
    /// The same grid as a CSV download. Grader-gated by the query it delegates to, not by this route.
    /// </summary>
    [HttpGet("{id:guid}/gradebook.csv")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileResult), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> ExportGradebookCsv(Guid id)
    {
        var result = await _mediator.Send(new ExportGradebookCsvQuery(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<string>(result.Message, result.ErrorCode);

        // UTF-8 BOM: without it Excel mis-decodes non-ASCII student names.
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }
            .Concat(System.Text.Encoding.UTF8.GetBytes(result.Data!))
            .ToArray();

        return File(bytes, "text/csv", $"gradebook-{id}.csv");
    }

    /// <summary>
    /// One student's progress: per-course cells, weakest topics, and a 30-day study-time trend.
    /// A student may request their own; reading another's requires grader rights.
    /// </summary>
    [HttpGet("{id:guid}/students/{studentUserId:guid}/progress")]
    [ProducesResponseType(typeof(BaseResponse<StudentProgressDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetStudentProgress(Guid id, Guid studentUserId)
    {
        var result = await _mediator.Send(new GetStudentProgressQuery(User.GetUserId(), id, studentUserId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<StudentProgressDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<StudentProgressDto>.Ok(result.Data!));
    }
}
