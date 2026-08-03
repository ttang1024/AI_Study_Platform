using Moq;
using StudyPlatform.Application.Integrations;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Integrations;

public class ApiKeyFormatTests
{
    [Fact]
    public void Generate_ProducesAPrefixedKeyAndAMatchingHash()
    {
        var (plaintext, hash, prefix) = ApiKeyFormat.Generate();

        Assert.StartsWith(ApiKeyFormat.KeyPrefix, plaintext);
        Assert.StartsWith(prefix, plaintext);
        Assert.Equal(hash, ApiKeyFormat.Hash(plaintext));
    }

    [Fact]
    public void Generate_IsUniquePerCall()
    {
        var keys = Enumerable.Range(0, 100).Select(_ => ApiKeyFormat.Generate().Plaintext).ToList();

        Assert.Equal(100, keys.Distinct().Count());
    }

    /// <summary>The stored prefix must not be enough to reconstruct or narrow the key.</summary>
    [Fact]
    public void Generate_PrefixIsShortEnoughToRevealNothing()
    {
        var (plaintext, _, prefix) = ApiKeyFormat.Generate();

        Assert.True(prefix.Length < plaintext.Length / 2);
    }

    [Fact]
    public void Hash_IsStable()
    {
        Assert.Equal(ApiKeyFormat.Hash("sp_example"), ApiKeyFormat.Hash("sp_example"));
        Assert.NotEqual(ApiKeyFormat.Hash("sp_example"), ApiKeyFormat.Hash("sp_example2"));
    }
}

public class ApiKeyUsabilityTests
{
    private static ApiKey Key(DateTime? expires = null, DateTime? revoked = null) =>
        new() { ExpiresAt = expires, RevokedAt = revoked };

    [Fact]
    public void FreshKeyIsUsable() => Assert.True(Key().IsUsable(DateTime.UtcNow));

    [Fact]
    public void RevokedKeyIsNot() =>
        Assert.False(Key(revoked: DateTime.UtcNow.AddMinutes(-1)).IsUsable(DateTime.UtcNow));

    [Fact]
    public void ExpiredKeyIsNot() =>
        Assert.False(Key(expires: DateTime.UtcNow.AddMinutes(-1)).IsUsable(DateTime.UtcNow));

    [Fact]
    public void KeyExpiringLaterIsStillUsable() =>
        Assert.True(Key(expires: DateTime.UtcNow.AddDays(1)).IsUsable(DateTime.UtcNow));
}

public class CreateApiKeyCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IApiKeyRepository> _keys = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly CreateApiKeyCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateApiKeyCommandHandlerTests()
    {
        _uow.Setup(u => u.ApiKeys).Returns(_keys.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _keys.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(Array.Empty<ApiKey>());
        _handler = new CreateApiKeyCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_ReturnsThePlaintextOnceAndStoresOnlyTheHash()
    {
        ApiKey? stored = null;
        _keys.Setup(r => r.AddAsync(It.IsAny<ApiKey>(), default))
            .Callback((ApiKey k, CancellationToken _) => stored = k)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateApiKeyCommand(
            _userId, "CI", new[] { ApiKeyScopes.ReadLibrary }, null), default);

        Assert.True(result.IsSuccess);
        Assert.StartsWith(ApiKeyFormat.KeyPrefix, result.Data!.PlaintextKey);

        // The plaintext must never reach the database.
        Assert.NotEqual(result.Data.PlaintextKey, stored!.KeyHash);
        Assert.Equal(ApiKeyFormat.Hash(result.Data.PlaintextKey), stored.KeyHash);
    }

    /// <summary>
    /// A key with no scopes authenticates and then fails at the caller's first request — worse than
    /// refusing here, where there is something actionable to say.
    /// </summary>
    [Fact]
    public async Task Handle_RefusesAKeyWithNoScopes()
    {
        var result = await _handler.Handle(new CreateApiKeyCommand(
            _userId, "CI", Array.Empty<string>(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("SCOPES_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DropsUnrecognisedScopes()
    {
        var result = await _handler.Handle(new CreateApiKeyCommand(
            _userId, "CI", new[] { ApiKeyScopes.ReadLibrary, "admin:everything" }, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(new[] { ApiKeyScopes.ReadLibrary }, result.Data!.Key.Scopes);
    }

    [Fact]
    public async Task Handle_RefusesAnUnnamedKey()
    {
        var result = await _handler.Handle(new CreateApiKeyCommand(
            _userId, "  ", new[] { ApiKeyScopes.ReadLibrary }, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NAME_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AppliesTheExpiryWindow()
    {
        var result = await _handler.Handle(new CreateApiKeyCommand(
            _userId, "CI", new[] { ApiKeyScopes.ReadLibrary }, 30), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Data!.Key.ExpiresAt);
        Assert.True(result.Data.Key.ExpiresAt > DateTime.UtcNow.AddDays(29));
    }
}

public class CreateWebhookCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWebhookRepository> _webhooks = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly CreateWebhookCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateWebhookCommandHandlerTests()
    {
        _uow.Setup(u => u.Webhooks).Returns(_webhooks.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _webhooks.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Webhook>());
        _handler = new CreateWebhookCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_CreatesAndReturnsTheSigningSecretOnce()
    {
        var result = await _handler.Handle(new CreateWebhookCommand(
            _userId, "https://example.com/hook", new[] { WebhookEvents.QuizCompleted }), default);

        Assert.True(result.IsSuccess);
        Assert.StartsWith("whsec_", result.Data!.Secret);
    }

    /// <summary>The payload carries study activity and the signature; neither belongs in the clear.</summary>
    [Fact]
    public async Task Handle_RefusesPlainHttp()
    {
        var result = await _handler.Handle(new CreateWebhookCommand(
            _userId, "http://example.com/hook", new[] { WebhookEvents.QuizCompleted }), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("HTTPS_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RefusesAMalformedUrl()
    {
        var result = await _handler.Handle(new CreateWebhookCommand(
            _userId, "not a url", new[] { WebhookEvents.QuizCompleted }), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_URL", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RefusesWhenNoKnownEventIsRequested()
    {
        var result = await _handler.Handle(new CreateWebhookCommand(
            _userId, "https://example.com/hook", new[] { "something.invented" }), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EVENTS_REQUIRED", result.ErrorCode);
    }

    /// <summary>The listing is what the UI renders; leaking the secret there would undo storing it once.</summary>
    [Fact]
    public async Task ListedWebhookNeverCarriesTheSecret()
    {
        _webhooks.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Webhook { WebhookId = Guid.NewGuid(), Url = "https://example.com", Secret = "whsec_topsecret", Events = "quiz.completed" },
        });

        var handler = new GetWebhooksQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetWebhooksQuery(_userId), default);

        var dto = result.Data!.Single();
        Assert.DoesNotContain("Secret", dto.GetType().GetProperties().Select(p => p.Name));
    }
}

public class WebhookSignatureTests
{
    /// <summary>
    /// Signing the timestamp alongside the body is what stops a captured delivery being replayed
    /// later — a body-only signature would stay valid forever.
    /// </summary>
    [Fact]
    public void Signature_ChangesWithTheTimestamp()
    {
        const string secret = "whsec_test";
        const string body = """{"type":"quiz.completed"}""";

        Assert.NotEqual(
            WebhookDispatcher.Sign(secret, 1_700_000_000, body),
            WebhookDispatcher.Sign(secret, 1_700_000_001, body));
    }

    [Fact]
    public void Signature_ChangesWithTheBody()
    {
        const string secret = "whsec_test";

        Assert.NotEqual(
            WebhookDispatcher.Sign(secret, 1_700_000_000, """{"a":1}"""),
            WebhookDispatcher.Sign(secret, 1_700_000_000, """{"a":2}"""));
    }

    [Fact]
    public void Signature_ChangesWithTheSecret()
    {
        const string body = """{"a":1}""";

        Assert.NotEqual(
            WebhookDispatcher.Sign("whsec_one", 1_700_000_000, body),
            WebhookDispatcher.Sign("whsec_two", 1_700_000_000, body));
    }

    [Fact]
    public void Signature_IsDeterministicAndHexEncoded()
    {
        var signature = WebhookDispatcher.Sign("whsec_test", 1_700_000_000, """{"a":1}""");

        Assert.Equal(64, signature.Length);
        Assert.All(signature, c => Assert.Contains(c, "0123456789abcdef"));
        Assert.Equal(signature, WebhookDispatcher.Sign("whsec_test", 1_700_000_000, """{"a":1}"""));
    }
}
