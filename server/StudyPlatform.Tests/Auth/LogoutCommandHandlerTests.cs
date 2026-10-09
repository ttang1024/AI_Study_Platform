using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class LogoutCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly LogoutCommandHandler _handler;

    public LogoutCommandHandlerTests()
    {
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new LogoutCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_KnownToken_RevokesItsWholeSession()
    {
        var token = new RefreshToken { TokenId = Guid.NewGuid(), UserId = Guid.NewGuid(), SessionId = Guid.NewGuid() };
        _tokens.Setup(r => r.FindByHashAsync(RefreshTokenHash.Compute("valid-token"), default)).ReturnsAsync(token);

        var result = await _handler.Handle(new LogoutCommand("valid-token"), default);

        Assert.True(result.IsSuccess);
        _tokens.Verify(r => r.RevokeSessionAsync(token.UserId, token.SessionId, default), Times.Once);
    }

    [Fact]
    public async Task Handle_TokenNotFound_StillReturnsSuccess()
    {
        _tokens.Setup(r => r.FindByHashAsync(It.IsAny<string>(), default)).ReturnsAsync((RefreshToken?)null);

        var result = await _handler.Handle(new LogoutCommand("nonexistent"), default);

        Assert.True(result.IsSuccess);
        _tokens.Verify(r => r.RevokeSessionAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
