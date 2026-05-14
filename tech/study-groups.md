# Study Groups

## Routes

`StudyGroupsController` is mounted at `/api/study-groups`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/study-groups` | List groups for current user |
| `POST` | `/api/study-groups` | Create group |
| `GET` | `/api/study-groups/{id}` | Group detail |
| `POST` | `/api/study-groups/join` | Join by invite/code |
| `DELETE` | `/api/study-groups/{id}/leave` | Leave group |
| `POST` | `/api/study-groups/{id}/share-course` | Share course with group |
| `DELETE` | `/api/study-groups/{id}/shared-courses/{courseId}` | Remove shared course |
| `GET` | `/api/study-groups/{id}/chat` | Load group chat history |
| `POST` | `/api/study-groups/{id}/chat` | Save/send group chat message |

SignalR hub: `/hubs/group-chat`.

## SignalR Hub

`GroupChatHub` enforces membership before allowing any operation. `JoinGroup` adds the connection to a SignalR group; `SendMessage` persists the message to the database then broadcasts it to all connected members.

```csharp
// GroupChatHub.cs
[Authorize]
public class GroupChatHub : Hub
{
    public async Task JoinGroup(string groupId)
    {
        if (!Guid.TryParse(groupId, out var groupGuid))
            throw new HubException("Invalid group ID.");

        var userId   = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers
            .ExistsAsync(m => m.GroupId == groupGuid && m.UserId == userId);

        if (!isMember) throw new HubException("Access denied.");

        await Groups.AddToGroupAsync(Context.ConnectionId, groupId);
    }

    public async Task SendMessage(string groupId, string content)
    {
        var userId   = Context.User!.GetUserId();
        var isMember = await _unitOfWork.StudyGroupMembers
            .ExistsAsync(m => m.GroupId == Guid.Parse(groupId) && m.UserId == userId);

        if (!isMember) throw new HubException("Access denied.");

        var msg = new GroupChatMessage
        {
            GroupChatMessageId = Guid.NewGuid(),
            GroupId  = Guid.Parse(groupId),
            UserId   = userId,
            Content  = content.Trim(),
            SentAt   = DateTime.UtcNow
        };
        await _unitOfWork.GroupChatMessages.AddAsync(msg);
        await _unitOfWork.SaveChangesAsync();

        await Clients.Group(groupId).SendAsync("ReceiveMessage", new GroupChatMessageDto(
            msg.GroupChatMessageId, msg.UserId, user?.FullName ?? "Unknown",
            msg.Content, msg.SentAt));
    }
}
```

## Group Detail Query

`GetGroupDetailQueryHandler` loads the group with its members and shared courses, verifies the requesting user is a member, and projects to DTOs:

```csharp
// StudyGroupCommands.cs — GetGroupDetailQueryHandler
var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(request.GroupId, ct);
if (group == null) return Result<StudyGroupDetailDto>.Failure("Group not found.", "NOT_FOUND");

var isMember = group.Members.Any(m => m.UserId == request.UserId);
if (!isMember) return Result<StudyGroupDetailDto>.Failure("Access denied.", "FORBIDDEN");

var dto = new StudyGroupDetailDto(
    group.StudyGroupId, group.Name, group.Description, group.InviteCode, group.CreatedAt,
    group.Members.Select(m => new GroupMemberDto(m.UserId, m.User.FullName, m.Role, m.JoinedAt)),
    group.SharedCourses.Select(sc => new SharedCourseDto(sc.CourseId, sc.Course.CourseName, sc.SharedAt)));
```

## Access Model

Shared courses can grant group members access to course content. YouTube video access checks include a shared-course path when the requester does not own the video.

## Frontend

`StudyGroupsPage`, `StudyGroupDetailPage`, `studyGroupService.ts`, and SignalR client dependency `@microsoft/signalr`.
