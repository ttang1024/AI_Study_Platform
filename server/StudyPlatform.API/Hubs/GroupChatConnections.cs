using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace StudyPlatform.API.Hubs;

/// <summary>
/// Which hub connections joined which study group, and as whom — what it takes to take a group away
/// from someone. SignalR group membership is granted once, at <c>JoinGroup</c>; nothing ties it to the
/// study-group membership it was granted for, so a removed member's open tab kept receiving every
/// message until it disconnected.
///
/// <para>Per process. With one API instance (production) that is all connections. Scaled out behind
/// the Redis backplane, a removal evicts only the connections on the instance that handled it; the
/// hub's per-message membership check still stops the removed user sending.</para>
/// </summary>
public sealed class GroupChatConnections
{
    private sealed record Joined(Guid UserId, string GroupId);

    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Joined, byte>> _byConnection = new();

    public void Record(string connectionId, Guid userId, string groupId)
        => _byConnection.GetOrAdd(connectionId, _ => new()).TryAdd(new Joined(userId, groupId), 0);

    public void Disconnected(string connectionId) => _byConnection.TryRemove(connectionId, out _);

    /// <summary>Removes <paramref name="userId"/>'s connections (every member's when null) from the group.</summary>
    public async Task EvictAsync(IHubContext<GroupChatHub> hub, Guid groupId, Guid? userId, CancellationToken cancellationToken = default)
    {
        var group = groupId.ToString();
        foreach (var (connectionId, joins) in _byConnection)
        {
            foreach (var join in joins.Keys.Where(j => j.GroupId == group && (userId == null || j.UserId == userId)))
            {
                joins.TryRemove(join, out _);
                await hub.Groups.RemoveFromGroupAsync(connectionId, group, cancellationToken);
                await hub.Clients.Client(connectionId).SendAsync("RemovedFromGroup", group, cancellationToken);
            }
        }
    }
}
