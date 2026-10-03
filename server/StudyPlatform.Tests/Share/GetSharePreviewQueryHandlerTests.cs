using Moq;
using StudyPlatform.Application.Share.Preview;
using StudyPlatform.Application.Share.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class GetSharePreviewQueryHandlerTests
{
    private const string Origin = "https://toto-study.com";

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IShareTokenRepository> _shareTokens = new();
    private readonly GetSharePreviewQueryHandler _handler;

    public GetSharePreviewQueryHandlerTests()
    {
        _uow.Setup(u => u.ShareTokens).Returns(_shareTokens.Object);
        _handler = new GetSharePreviewQueryHandler(
            _uow.Object,
            new SharePreviewFactory(new SummarySnippetExtractor(), new ShareContentsInventory()));
    }

    [Fact]
    public async Task Handle_ExistingShare_ReturnsItsCard()
    {
        _shareTokens.Setup(r => r.GetByTokenAsync("abc", default)).ReturnsAsync(new ShareToken
        {
            Token = "abc",
            Title = "GANs",
            Summary = "Adversarial training.",
            Owner = new User { FullName = "Ting Tang" },
            CreatedAt = DateTime.UtcNow,
        });

        var result = await _handler.Handle(new GetSharePreviewQuery("abc", Origin), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("GANs", result.Data!.Title);
        Assert.Equal("https://toto-study.com/share/abc", result.Data.Url);
    }

    [Fact]
    public async Task Handle_UnknownToken_Fails()
    {
        _shareTokens.Setup(r => r.GetByTokenAsync("nope", default)).ReturnsAsync((ShareToken?)null);

        var result = await _handler.Handle(new GetSharePreviewQuery("nope", Origin), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(GetSharePreviewQueryHandler.NotFoundCode, result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ExpiredShare_Fails()
    {
        _shareTokens.Setup(r => r.GetByTokenAsync("old", default)).ReturnsAsync(new ShareToken
        {
            Token = "old",
            Title = "GANs",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
        });

        var result = await _handler.Handle(new GetSharePreviewQuery("old", Origin), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(GetSharePreviewQueryHandler.ExpiredCode, result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ShareThatHasNotExpiredYet_Succeeds()
    {
        _shareTokens.Setup(r => r.GetByTokenAsync("live", default)).ReturnsAsync(new ShareToken
        {
            Token = "live",
            Title = "GANs",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
        });

        Assert.True((await _handler.Handle(new GetSharePreviewQuery("live", Origin), default)).IsSuccess);
    }

    [Fact]
    public async Task Handle_BlankToken_FailsWithoutHittingTheDatabase()
    {
        var result = await _handler.Handle(new GetSharePreviewQuery("  ", Origin), default);

        Assert.False(result.IsSuccess);
        _shareTokens.Verify(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
