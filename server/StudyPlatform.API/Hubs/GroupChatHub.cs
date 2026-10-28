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
    private readonly IUserRepository _users;
    private readonly IStudyGroupMemberRepository _studyGroupMembers;
    private readonly IGroupChatMessageRepository _groupChatMessages;
    private readonly GroupChatConnections _connections;

    public GroupChatHub(IUnitOfWork unitOfWork, IUserRepository users, IStudyGroupMemberRepository studyGroupMembers, IGroupChatMessageRepository groupChatMessages, GroupChatConnections connections)
    {
        _connections = connections;
        _unitOfWork = unitOfWork;
        _users = users;
        _studyGroupMembers = studyGroupMembers;
        _groupChatMessages = groupChatMessages;
    }

    public async Task JoinGroup(string groupId)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");

        var userId = Context.User!.GetUserId();
        var isMember = await _studyGroupMembers.ExistsAsync(
            m => m.GroupId == groupGuid && m.UserId == userId);

        if (!isMember || !await IsActiveAsync(userId))
            throw new HubException("Access denied.");

        await Groups.AddToGroupAsync(Context.ConnectionId, groupId);
        // Recorded so leaving, removal or deletion can take the subscription back (GroupChatConnections).
        _connections.Record(Context.ConnectionId, userId, groupId);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _connections.Disconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string groupId, string content)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");

        if (string.IsNullOrWhiteSpace(content))
            throw new HubException("Message cannot be empty.");

        var userId = Context.User!.GetUserId();
        var isMember = await _studyGroupMembers.ExistsAsync(
            m => m.GroupId == groupGuid && m.UserId == userId);

        if (!isMember)
            throw new HubException("Access denied.");

        // Checked per message, not just at connect: a connection outlives the access token that opened it,
        // so a deactivated account could otherwise keep posting for as long as its tab stayed open.
        var user = await _users.GetByIdAsync(userId);
        if (user is not { IsActive: true })
            throw new HubException("Access denied.");

        var msg = new GroupChatMessage
        {
            GroupChatMessageId = Guid.NewGuid(),
            GroupId = groupGuid,
            UserId = userId,
            Content = content.Trim(),
            SentAt = DateTime.UtcNow
        };

        await _groupChatMessages.AddAsync(msg);
        await _unitOfWork.SaveChangesAsync();

        var dto = new GroupChatMessageDto(
            msg.GroupChatMessageId,
            msg.UserId,
            user.FullName,
            msg.Content,
            msg.SentAt);

        await Clients.Group(groupId).SendAsync("ReceiveMessage", dto);
    }

    private async Task<bool> IsActiveAsync(Guid userId)
        => (await _users.GetByIdAsync(userId)) is { IsActive: true };
}
