using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.StudyGroups;

namespace StudyPlatform.API.Controllers;

// Group chat: history and posting messages.
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

    /// <summary>
    /// Send a chat message to a study group
    /// </summary>
    [HttpPost("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<GroupChatMessageDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 403)]
    public async Task<IActionResult> SendGroupChatMessage(Guid id, [FromBody] SendGroupChatMessageRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SendGroupChatMessageCommand(userId, id, request.Content));

        if (!result.IsSuccess)
            return StatusCode(403, BaseResponse<GroupChatMessageDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<GroupChatMessageDto>.Ok(result.Data!, result.Message));
    }
}

public record SendGroupChatMessageRequest(string Content);
