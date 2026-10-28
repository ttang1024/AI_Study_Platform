using System.Linq.Expressions;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Moq;
using StudyPlatform.API.Hubs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Hubs;

/// <summary>
/// Group chat access is checked on the way in; these pin that it is also taken back on the way out —
/// a removed member, or a deactivated account, must stop receiving and sending.
/// </summary>
public class GroupChatHubTests
{
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IGroupChatMessageRepository> _messages = new();
    private readonly Mock<IGroupManager> _groups = new();
    private readonly GroupChatConnections _connections = new();

    private GroupChatHub Hub(string connectionId)
    {
        var context = new Mock<HubCallerContext>();
        context.SetupGet(c => c.ConnectionId).Returns(connectionId);
        context.SetupGet(c => c.User).Returns(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, _userId.ToString())])));
        var clients = new Mock<IHubCallerClients>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(Mock.Of<IClientProxy>());
        return new GroupChatHub(Mock.Of<IUnitOfWork>(), _users.Object, _members.Object, _messages.Object, _connections)
        {
            Context = context.Object,
            Groups = _groups.Object,
            Clients = clients.Object,
        };
    }

    private void Member(bool isMember = true, bool isActive = true)
    {
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(isMember);
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { UserId = _userId, FullName = "U", IsActive = isActive });
    }

    [Fact]
    public async Task NonMember_CannotJoin()
    {
        Member(isMember: false);

        await Assert.ThrowsAsync<HubException>(() => Hub("c1").JoinGroup(_groupId.ToString()));
        _groups.Verify(g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeactivatedAccount_CannotSend_EvenOnAnOpenConnection()
    {
        Member(isActive: false);

        await Assert.ThrowsAsync<HubException>(() => Hub("c1").SendMessage(_groupId.ToString(), "hello"));
        _messages.Verify(r => r.AddAsync(It.IsAny<GroupChatMessage>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RemovingAMember_EvictsOnlyTheirConnections_FromThatGroup()
    {
        Member();
        await Hub("removed-tab").JoinGroup(_groupId.ToString());
        var otherUser = Guid.NewGuid();
        _connections.Record("other-tab", otherUser, _groupId.ToString());
        _connections.Record("removed-tab-other-group", _userId, Guid.NewGuid().ToString());

        var hubGroups = new Mock<IGroupManager>();
        var hubClients = new Mock<IHubClients>();
        hubClients.Setup(c => c.Client(It.IsAny<string>())).Returns(Mock.Of<ISingleClientProxy>());
        var hub = new Mock<IHubContext<GroupChatHub>>();
        hub.SetupGet(h => h.Groups).Returns(hubGroups.Object);
        hub.SetupGet(h => h.Clients).Returns(hubClients.Object);

        await _connections.EvictAsync(hub.Object, _groupId, _userId);

        // The subscription JoinGroup granted used to outlive the membership: the removed tab kept
        // receiving every message until it disconnected.
        hubGroups.Verify(g => g.RemoveFromGroupAsync("removed-tab", _groupId.ToString(), It.IsAny<CancellationToken>()), Times.Once);
        hubGroups.Verify(g => g.RemoveFromGroupAsync("other-tab", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        hubGroups.Verify(g => g.RemoveFromGroupAsync("removed-tab-other-group", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeletingAGroup_EvictsEveryone_AndADisconnectedTabIsForgotten()
    {
        _connections.Record("a", Guid.NewGuid(), _groupId.ToString());
        _connections.Record("b", Guid.NewGuid(), _groupId.ToString());
        _connections.Disconnected("b");
        var hubGroups = new Mock<IGroupManager>();
        var hubClients = new Mock<IHubClients>();
        hubClients.Setup(c => c.Client(It.IsAny<string>())).Returns(Mock.Of<ISingleClientProxy>());
        var hub = new Mock<IHubContext<GroupChatHub>>();
        hub.SetupGet(h => h.Groups).Returns(hubGroups.Object);
        hub.SetupGet(h => h.Clients).Returns(hubClients.Object);

        await _connections.EvictAsync(hub.Object, _groupId, userId: null);

        hubGroups.Verify(g => g.RemoveFromGroupAsync("a", _groupId.ToString(), It.IsAny<CancellationToken>()), Times.Once);
        hubGroups.Verify(g => g.RemoveFromGroupAsync("b", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
