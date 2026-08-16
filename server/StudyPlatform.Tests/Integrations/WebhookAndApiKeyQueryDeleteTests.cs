using Moq;
using StudyPlatform.Application.Integrations;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Integrations;

public class GetWebhooksQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWebhookRepository> _webhooks = new();
    private readonly GetWebhooksQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetWebhooksQueryHandlerTests()
    {
        _uow.Setup(u => u.Webhooks).Returns(_webhooks.Object);
        _handler = new GetWebhooksQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedWebhooksWithoutSecret()
    {
        var webhook = new Webhook
        {
            WebhookId = Guid.NewGuid(),
            UserId = _userId,
            Url = "https://example.com/hook",
            Events = "flashcard.created,quiz.completed",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        _webhooks.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new[] { webhook });

        var result = await _handler.Handle(new GetWebhooksQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal(new[] { "flashcard.created", "quiz.completed" }, dto.Events);
    }

    [Fact]
    public async Task Handle_NoWebhooks_ReturnsEmpty()
    {
        _webhooks.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Webhook>());

        var result = await _handler.Handle(new GetWebhooksQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}

public class DeleteWebhookCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWebhookRepository> _webhooks = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly DeleteWebhookCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _webhookId = Guid.NewGuid();

    public DeleteWebhookCommandHandlerTests()
    {
        _uow.Setup(u => u.Webhooks).Returns(_webhooks.Object);
        _handler = new DeleteWebhookCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _webhooks.Setup(r => r.GetByIdAsync(_webhookId, default)).ReturnsAsync((Webhook?)null);

        var result = await _handler.Handle(new DeleteWebhookCommand(_userId, _webhookId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("WEBHOOK_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var webhook = new Webhook { WebhookId = _webhookId, UserId = Guid.NewGuid() };
        _webhooks.Setup(r => r.GetByIdAsync(_webhookId, default)).ReturnsAsync(webhook);

        var result = await _handler.Handle(new DeleteWebhookCommand(_userId, _webhookId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("WEBHOOK_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_RemovesAndLogsAudit()
    {
        var webhook = new Webhook { WebhookId = _webhookId, UserId = _userId };
        _webhooks.Setup(r => r.GetByIdAsync(_webhookId, default)).ReturnsAsync(webhook);

        var result = await _handler.Handle(new DeleteWebhookCommand(_userId, _webhookId), default);

        Assert.True(result.IsSuccess);
        _webhooks.Verify(r => r.Remove(webhook), Times.Once);
        _audit.Verify(a => a.LogAsync(
            AuditActions.WebhookDeleted, _userId, null, "Webhook", _webhookId.ToString(), null, default), Times.Once);
    }
}

public class GetApiKeysQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IApiKeyRepository> _keys = new();
    private readonly GetApiKeysQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetApiKeysQueryHandlerTests()
    {
        _uow.Setup(u => u.ApiKeys).Returns(_keys.Object);
        _handler = new GetApiKeysQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedKeys()
    {
        var key = new ApiKey
        {
            ApiKeyId = Guid.NewGuid(),
            UserId = _userId,
            Name = "CI Key",
            Prefix = "sp_abc",
            Scopes = "read:library,read:flashcards",
            CreatedAt = DateTime.UtcNow,
        };
        _keys.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new[] { key });

        var result = await _handler.Handle(new GetApiKeysQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal("CI Key", dto.Name);
        Assert.Equal(new[] { "read:library", "read:flashcards" }, dto.Scopes);
    }
}

public class RevokeApiKeyCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IApiKeyRepository> _keys = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RevokeApiKeyCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _keyId = Guid.NewGuid();

    public RevokeApiKeyCommandHandlerTests()
    {
        _uow.Setup(u => u.ApiKeys).Returns(_keys.Object);
        _handler = new RevokeApiKeyCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _keys.Setup(r => r.GetByIdAsync(_keyId, default)).ReturnsAsync((ApiKey?)null);

        var result = await _handler.Handle(new RevokeApiKeyCommand(_userId, _keyId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("API_KEY_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var key = new ApiKey { ApiKeyId = _keyId, UserId = Guid.NewGuid() };
        _keys.Setup(r => r.GetByIdAsync(_keyId, default)).ReturnsAsync(key);

        var result = await _handler.Handle(new RevokeApiKeyCommand(_userId, _keyId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("API_KEY_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyRevoked_ReturnsFailure()
    {
        var key = new ApiKey { ApiKeyId = _keyId, UserId = _userId, RevokedAt = DateTime.UtcNow.AddDays(-1) };
        _keys.Setup(r => r.GetByIdAsync(_keyId, default)).ReturnsAsync(key);

        var result = await _handler.Handle(new RevokeApiKeyCommand(_userId, _keyId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_REVOKED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Active_RevokesAndLogsAudit()
    {
        var key = new ApiKey { ApiKeyId = _keyId, UserId = _userId, RevokedAt = null };
        _keys.Setup(r => r.GetByIdAsync(_keyId, default)).ReturnsAsync(key);

        var result = await _handler.Handle(new RevokeApiKeyCommand(_userId, _keyId), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(key.RevokedAt);
        _audit.Verify(a => a.LogAsync(
            AuditActions.ApiKeyRevoked, _userId, null, "ApiKey", _keyId.ToString(), null, default), Times.Once);
    }
}
