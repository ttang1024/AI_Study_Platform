using Moq;
using StudyPlatform.Application.Admin.Commands;
using StudyPlatform.Application.Admin.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Admin;

public class AdminLoginCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ITokenService> _tokens = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly AdminLoginCommandHandler _handler;

    public AdminLoginCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _handler = new AdminLoginCommandHandler(_uow.Object, _tokens.Object, _hasher.Object);
    }

    [Fact]
    public async Task Handle_UnknownEmail_ReturnsInvalidCredentials()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new AdminLoginCommand("a@b.com", "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsInvalidCredentials()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash", IsAdmin = true });
        _hasher.Setup(h => h.Verify("wrong", "hash")).Returns(false);

        var result = await _handler.Handle(new AdminLoginCommand("a@b.com", "wrong"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonAdminUser_ReturnsForbidden()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash", IsAdmin = false });
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);

        var result = await _handler.Handle(new AdminLoginCommand("a@b.com", "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_LowercasesEmailBeforeLookup()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash", IsAdmin = true });
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        _tokens.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("token-1");

        var result = await _handler.Handle(new AdminLoginCommand("A@B.COM", "pw"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("token-1", result.Data!.Token);
    }
}

public class GetFeedbackByIdQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly GetFeedbackByIdQueryHandler _handler;

    public GetFeedbackByIdQueryHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _handler = new GetFeedbackByIdQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        var id = Guid.NewGuid();
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync((Domain.Entities.Feedback?)null);

        var result = await _handler.Handle(new GetFeedbackByIdQuery(id), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_ReturnsMappedDto()
    {
        var id = Guid.NewGuid();
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync(new Domain.Entities.Feedback { Id = id, Type = "bug", Subject = "S", Message = "M" });

        var result = await _handler.Handle(new GetFeedbackByIdQuery(id), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("bug", result.Data!.Type);
    }
}

public class GetFeedbackStatsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly GetFeedbackStatsQueryHandler _handler;

    public GetFeedbackStatsQueryHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _handler = new GetFeedbackStatsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsStatsFromRepository()
    {
        _feedbacks.Setup(r => r.GetStatsAsync(It.IsAny<DateTime>(), default))
            .ReturnsAsync(new FeedbackStats(10, new Dictionary<string, int> { ["bug"] = 5 }, new Dictionary<string, int> { ["new"] = 3 }, 4.2, 2));

        var result = await _handler.Handle(new GetFeedbackStatsQuery(), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Data!.Total);
        Assert.Equal(5, result.Data.ByType["bug"]);
        Assert.Equal(4.2, result.Data.AverageRating);
    }
}

public class ListFeedbackQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly ListFeedbackQueryHandler _handler;

    public ListFeedbackQueryHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _handler = new ListFeedbackQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsPaginatedMappedItems()
    {
        _feedbacks.Setup(r => r.ListAsync(1, 20, "new", "bug", "search", "recent", default))
            .ReturnsAsync((new List<Domain.Entities.Feedback> { new() { Id = Guid.NewGuid(), Type = "bug" } }, 1));

        var result = await _handler.Handle(new ListFeedbackQuery(1, 20, "new", "bug", "search", "recent"), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Items);
        Assert.Equal(1, result.Data.TotalCount);
    }
}

public class ListUsersQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly ListUsersQueryHandler _handler;

    public ListUsersQueryHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _handler = new ListUsersQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsUsersToDtos()
    {
        _users.Setup(r => r.ListAsync(1, 20, "q", "active", "recent", default))
            .ReturnsAsync((new List<User> { new() { UserId = Guid.NewGuid(), Email = "a@b.com", FullName = "Ada" } }, 1));

        var result = await _handler.Handle(new ListUsersQuery(1, 20, "q", "active", "recent"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Ada", result.Data!.Items.Single().FullName);
    }
}

public class DeleteFeedbackCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly DeleteFeedbackCommandHandler _handler;

    public DeleteFeedbackCommandHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteFeedbackCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        var id = Guid.NewGuid();
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync((Domain.Entities.Feedback?)null);

        var result = await _handler.Handle(new DeleteFeedbackCommand(id), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_RemovesIt()
    {
        var id = Guid.NewGuid();
        var feedback = new Domain.Entities.Feedback { Id = id };
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync(feedback);

        var result = await _handler.Handle(new DeleteFeedbackCommand(id), default);

        Assert.True(result.IsSuccess);
        _feedbacks.Verify(r => r.Remove(feedback), Times.Once);
    }
}

public class SaveAdminNoteCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly SaveAdminNoteCommandHandler _handler;

    public SaveAdminNoteCommandHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SaveAdminNoteCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        var id = Guid.NewGuid();
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync((Domain.Entities.Feedback?)null);

        var result = await _handler.Handle(new SaveAdminNoteCommand(id, "note"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_SavesNote()
    {
        var id = Guid.NewGuid();
        var feedback = new Domain.Entities.Feedback { Id = id };
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync(feedback);

        var result = await _handler.Handle(new SaveAdminNoteCommand(id, "resolved offline"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("resolved offline", feedback.AdminNote);
    }
}

public class UpdateFeedbackStatusCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFeedbackRepository> _feedbacks = new();
    private readonly UpdateFeedbackStatusCommandHandler _handler;

    public UpdateFeedbackStatusCommandHandlerTests()
    {
        _uow.Setup(u => u.Feedbacks).Returns(_feedbacks.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateFeedbackStatusCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        var id = Guid.NewGuid();
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync((Domain.Entities.Feedback?)null);

        var result = await _handler.Handle(new UpdateFeedbackStatusCommand(id, "resolved"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ResolvedStatus_SetsResolvedAt()
    {
        var id = Guid.NewGuid();
        var feedback = new Domain.Entities.Feedback { Id = id, Status = "new" };
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync(feedback);

        var result = await _handler.Handle(new UpdateFeedbackStatusCommand(id, "resolved"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("resolved", feedback.Status);
        Assert.NotNull(feedback.ResolvedAt);
    }

    [Fact]
    public async Task Handle_NonResolvedStatus_LeavesResolvedAtNull()
    {
        var id = Guid.NewGuid();
        var feedback = new Domain.Entities.Feedback { Id = id, Status = "new" };
        _feedbacks.Setup(r => r.GetByIdAsync(id, default)).ReturnsAsync(feedback);

        await _handler.Handle(new UpdateFeedbackStatusCommand(id, "in_progress"), default);

        Assert.Null(feedback.ResolvedAt);
    }
}

public class SetUserActiveStatusCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly SetUserActiveStatusCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SetUserActiveStatusCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SetUserActiveStatusCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new SetUserActiveStatusCommand(_userId, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AdminUser_CannotBeDeactivated()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, IsAdmin = true });

        var result = await _handler.Handle(new SetUserActiveStatusCommand(_userId, false), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RegularUser_UpdatesActiveStatus()
    {
        var user = new User { UserId = _userId, IsAdmin = false, IsActive = true };
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);

        var result = await _handler.Handle(new SetUserActiveStatusCommand(_userId, false), default);

        Assert.True(result.IsSuccess);
        Assert.False(user.IsActive);
        Assert.False(result.Data!.IsActive);
    }
}

public class GetPlatformAnalyticsQueryHandlerTests
{
    private readonly Mock<IAdminAnalyticsRepository> _analytics = new();
    private readonly GetPlatformAnalyticsQueryHandler _handler;

    public GetPlatformAnalyticsQueryHandlerTests()
    {
        _handler = new GetPlatformAnalyticsQueryHandler(_analytics.Object);
    }

    [Fact]
    public async Task Handle_ReturnsRepositoryData()
    {
        var data = new PlatformAnalytics(
            new UserMetrics(10, 8, 2, 1, 9, 2, 5),
            new EngagementMetrics(3, 5, 8, 120, 10, 4, 20),
            new ContentMetrics(5, 2, 3, 10, 40, 6, 15),
            Array.Empty<DailyCount>(), Array.Empty<DailyCount>(), Array.Empty<TopUser>());
        _analytics.Setup(a => a.GetPlatformAnalyticsAsync(default)).ReturnsAsync(data);

        var result = await _handler.Handle(new GetPlatformAnalyticsQuery(), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Data!.Users.Total);
    }
}

public class GetUserDetailQueryHandlerTests
{
    private readonly Mock<IAdminAnalyticsRepository> _analytics = new();
    private readonly GetUserDetailQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetUserDetailQueryHandlerTests()
    {
        _handler = new GetUserDetailQueryHandler(_analytics.Object);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _analytics.Setup(a => a.GetUserDetailAsync(_userId, default)).ReturnsAsync((UserActivityDetail?)null);

        var result = await _handler.Handle(new GetUserDetailQuery(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UserFound_ReturnsDetail()
    {
        var detail = new UserActivityDetail(
            _userId, "a@b.com", "Ada", false, true, true, DateTime.UtcNow, null,
            new UserContentCounts(1, 2, 3, 4, 5, 6, 7), 100, 50, 10, 8, 90.0, Array.Empty<DailyCount>());
        _analytics.Setup(a => a.GetUserDetailAsync(_userId, default)).ReturnsAsync(detail);

        var result = await _handler.Handle(new GetUserDetailQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Ada", result.Data!.FullName);
    }
}
