using System.Collections.Concurrent;
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
    // ── Live co-study room state (in-memory; presence only, nothing persisted) ──
    private sealed record RoomMember(Guid UserId, string Name, string Status);

    private sealed class RoomState
    {
        public readonly ConcurrentDictionary<string, RoomMember> Members = new(); // keyed by connection id
        public DateTime? TimerEndsAtUtc;
        public int TimerMinutes;
        public string? TimerStartedBy;
    }

    private static readonly ConcurrentDictionary<string, RoomState> Rooms = new();          // groupId → room
    private static readonly ConcurrentDictionary<string, string> ConnectionRooms = new();   // connectionId → groupId

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

    // ── Live co-study room: shared presence + pomodoro ───────────────────────

    /// <summary>Enter the group's study room; everyone in the group sees you studying.</summary>
    public async Task JoinStudyRoom(string groupId)
    {
        await RequireMembershipAsync(groupId);
        var user = await _unitOfWork.Users.GetByIdAsync(Context.User!.GetUserId());

        var room = Rooms.GetOrAdd(groupId, _ => new RoomState());
        room.Members[Context.ConnectionId] = new RoomMember(
            Context.User!.GetUserId(), user?.FullName ?? "Someone", "studying");
        ConnectionRooms[Context.ConnectionId] = groupId;

        await BroadcastRoomStateAsync(groupId);
    }

    public async Task LeaveStudyRoom(string groupId)
    {
        if (Rooms.TryGetValue(groupId, out var room))
            room.Members.TryRemove(Context.ConnectionId, out _);
        ConnectionRooms.TryRemove(Context.ConnectionId, out _);
        await BroadcastRoomStateAsync(groupId);
    }

    /// <summary>Flip your visible status between "studying" and "break".</summary>
    public async Task SetStudyStatus(string groupId, string status)
    {
        if (status is not ("studying" or "break"))
            throw new HubException("Invalid status.");
        if (Rooms.TryGetValue(groupId, out var room)
            && room.Members.TryGetValue(Context.ConnectionId, out var member))
        {
            room.Members[Context.ConnectionId] = member with { Status = status };
            await BroadcastRoomStateAsync(groupId);
        }
    }

    /// <summary>Start (or restart) the room's shared focus timer for everyone.</summary>
    public async Task StartRoomTimer(string groupId, int minutes)
    {
        await RequireMembershipAsync(groupId);
        minutes = Math.Clamp(minutes, 5, 120);

        var room = Rooms.GetOrAdd(groupId, _ => new RoomState());
        var user = await _unitOfWork.Users.GetByIdAsync(Context.User!.GetUserId());
        room.TimerEndsAtUtc = DateTime.UtcNow.AddMinutes(minutes);
        room.TimerMinutes = minutes;
        room.TimerStartedBy = user?.FullName ?? "Someone";

        await BroadcastRoomStateAsync(groupId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectionRooms.TryRemove(Context.ConnectionId, out var groupId))
        {
            if (Rooms.TryGetValue(groupId, out var room))
                room.Members.TryRemove(Context.ConnectionId, out _);
            await BroadcastRoomStateAsync(groupId);
        }
        await base.OnDisconnectedAsync(exception);
    }

    private async Task<Guid> RequireMembershipAsync(string groupId)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");
        var userId = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == groupGuid && m.UserId == userId);
        if (!isMember)
            throw new HubException("Access denied.");
        return groupGuid;
    }

    private async Task BroadcastRoomStateAsync(string groupId)
    {
        Rooms.TryGetValue(groupId, out var room);

        // Expired timers read as cleared so late joiners don't see a stale countdown.
        var timerActive = room?.TimerEndsAtUtc is { } ends && ends > DateTime.UtcNow;
        var memberValues = (IEnumerable<RoomMember>?)room?.Members.Values ?? Enumerable.Empty<RoomMember>();
        var state = new
        {
            members = memberValues
                .GroupBy(m => m.UserId)
                .Select(g => new { userId = g.Key, name = g.First().Name, status = g.First().Status })
                .ToArray(),
            timerEndsAt = timerActive ? room!.TimerEndsAtUtc : null,
            timerMinutes = timerActive ? room!.TimerMinutes : 0,
            timerStartedBy = timerActive ? room!.TimerStartedBy : null,
        };
        await Clients.Group(groupId).SendAsync("RoomState", state);
    }
}
