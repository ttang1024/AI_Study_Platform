using System.Collections.Concurrent;
using MediatR;
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

    public GroupChatHub(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
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

    // ── Collaborative notes (Yjs CRDT sync) ───────────────────────────────────
    // The server relays Yjs updates between editors of the same note and persists
    // debounced full-state snapshots; it never needs to understand the CRDT itself.

    private readonly IMediator _mediator;

    /// <summary>Join a note's edit session. Returns the persisted Yjs state (base64) to hydrate from.</summary>
    public async Task<string> JoinNote(string noteId)
    {
        var note = await RequireNoteAccessAsync(noteId);
        await Groups.AddToGroupAsync(Context.ConnectionId, NoteGroup(noteId));
        return Convert.ToBase64String(note.State);
    }

    public async Task LeaveNote(string noteId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, NoteGroup(noteId));
        await Clients.OthersInGroup(NoteGroup(noteId)).SendAsync("NotePeerLeft", Context.ConnectionId);
    }

    /// <summary>Relay an incremental Yjs update to everyone else editing the note.</summary>
    public async Task SendNoteUpdate(string noteId, string updateBase64)
    {
        if (string.IsNullOrEmpty(updateBase64) || updateBase64.Length > 512 * 1024)
            throw new HubException("Invalid update.");
        await RequireNoteAccessAsync(noteId);
        await Clients.OthersInGroup(NoteGroup(noteId)).SendAsync("ReceiveNoteUpdate", updateBase64);
    }

    /// <summary>Relay awareness (cursor/selection/name) state; not persisted.</summary>
    public async Task SendNoteAwareness(string noteId, string awarenessBase64)
    {
        if (string.IsNullOrEmpty(awarenessBase64) || awarenessBase64.Length > 64 * 1024)
            return;
        await Clients.OthersInGroup(NoteGroup(noteId)).SendAsync("ReceiveNoteAwareness", awarenessBase64);
    }

    /// <summary>Persist the merged full document state (clients call this on a debounce).</summary>
    public async Task SaveNoteState(string noteId, string stateBase64, string contentPreview)
    {
        if (!Guid.TryParse(noteId, out var noteGuid))
            throw new HubException("Invalid note ID.");

        byte[] state;
        try
        {
            state = Convert.FromBase64String(stateBase64);
        }
        catch (FormatException)
        {
            throw new HubException("Invalid state encoding.");
        }

        var result = await _mediator.Send(new SaveGroupNoteStateCommand(
            noteGuid, Context.User!.GetUserId(), state, contentPreview ?? ""));
        if (!result.IsSuccess)
            throw new HubException(result.Message);
    }

    private static string NoteGroup(string noteId) => $"note:{noteId}";

    private async Task<GroupNote> RequireNoteAccessAsync(string noteId)
    {
        if (!Guid.TryParse(noteId, out var noteGuid))
            throw new HubException("Invalid note ID.");
        var note = await _unitOfWork.GroupNotes.GetByIdAsync(noteGuid);
        if (note == null)
            throw new HubException("Note not found.");
        var userId = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == note.GroupId && m.UserId == userId);
        if (!isMember)
            throw new HubException("Access denied.");
        return note;
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
