using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Hubs;

[Authorize]
public class GroupChatHub : Hub
{
    private readonly IUnitOfWork _unitOfWork;

    public GroupChatHub(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task JoinGroup(string groupId)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");

        var userId = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == groupGuid && m.UserId == userId);

        if (!isMember)
            throw new HubException("Access denied.");

        await Groups.AddToGroupAsync(Context.ConnectionId, groupId);
    }

    public async Task SendMessage(string groupId, string content)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");

        if (string.IsNullOrWhiteSpace(content))
            throw new HubException("Message cannot be empty.");

        var userId = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == groupGuid && m.UserId == userId);

        if (!isMember)
            throw new HubException("Access denied.");

        var user = await _unitOfWork.Users.GetByIdAsync(userId);

        var msg = new GroupChatMessage
        {
            GroupChatMessageId = Guid.NewGuid(),
            GroupId = groupGuid,
            UserId = userId,
            Content = content.Trim(),
            SentAt = DateTime.UtcNow
        };

        await _unitOfWork.GroupChatMessages.AddAsync(msg);
        await _unitOfWork.SaveChangesAsync();

        var dto = new GroupChatMessageDto(
            msg.GroupChatMessageId,
            msg.UserId,
            user?.FullName ?? "Unknown",
            msg.Content,
            msg.SentAt);

        await Clients.Group(groupId).SendAsync("ReceiveMessage", dto);
    }
}
