using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Group chat history. Messages are sent through GroupChatHub, never over HTTP.
public partial class StudyGroupsController
{
    /// <summary>
    /// Get chat messages for a study group
    /// </summary>
    [HttpGet("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<GroupChatMessageDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> GetGroupChat(Guid id, [FromQuery] int page = 1)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetGroupChatQuery(userId, id, page));

        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<IEnumerable<GroupChatMessageDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<GroupChatMessageDto>>.Ok(result.Data!));
    }
}
