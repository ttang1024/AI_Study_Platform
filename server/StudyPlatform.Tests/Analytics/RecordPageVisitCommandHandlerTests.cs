using Moq;
using StudyPlatform.Application.Analytics.Commands;
using StudyPlatform.Application.Analytics.Validators;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class RecordPageVisitCommandHandlerTests
{
    private const string Chrome =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36";

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IPageVisitRepository> _visits = new();
    private readonly RecordPageVisitCommandHandler _handler;
    private PageVisit? _saved;

    public RecordPageVisitCommandHandlerTests()
    {
        _uow.Setup(u => u.PageVisits).Returns(_visits.Object);
        _visits.Setup(r => r.AddAsync(It.IsAny<PageVisit>(), default))
            .Callback<PageVisit, CancellationToken>((v, _) => _saved = v)
            .Returns(Task.CompletedTask);
        _handler = new RecordPageVisitCommandHandler(_uow.Object);
    }

    private static RecordPageVisitCommand Command(
        string path = "/library",
        Guid? userId = null,
        string? referrer = null,
        string userAgent = Chrome) =>
        new(userId, path, referrer, "visitor-1", "session-1", userAgent, "toto-study.com");

    [Fact]
    public async Task Handle_StoresTheVisitWithANormalisedPath()
    {
        var result = await _handler.Handle(Command("/documents/0f8fad5b-d9cb-469f-a165-70867728950e?tab=notes"), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(_saved);
        Assert.Equal("/documents/:id", _saved!.Path);
        Assert.Equal("desktop", _saved.Device);
        Assert.Null(_saved.UserId);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_AttributesTheVisitWhenTheCallerIsSignedIn()
    {
        var userId = Guid.NewGuid();

        await _handler.Handle(Command(userId: userId), default);

        Assert.Equal(userId, _saved!.UserId);
    }

    [Fact]
    public async Task Handle_KeepsOnlyTheHostOfAnExternalReferrer()
    {
        await _handler.Handle(Command(referrer: "https://news.ycombinator.com/item?id=1"), default);

        Assert.Equal("news.ycombinator.com", _saved!.Referrer);
    }

    [Fact]
    public async Task Handle_DropsAReferrerFromOurOwnSite()
    {
        await _handler.Handle(Command(referrer: "https://toto-study.com/dashboard"), default);

        Assert.Null(_saved!.Referrer);
    }

    [Fact]
    public async Task Handle_IgnoresCrawlersWithoutStoringOrFailing()
    {
        var result = await _handler.Handle(Command(userAgent: "facebookexternalhit/1.1"), default);

        Assert.True(result.IsSuccess);
        _visits.Verify(r => r.AddAsync(It.IsAny<PageVisit>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}

public class RecordPageVisitValidatorTests
{
    private readonly RecordPageVisitValidator _validator = new();

    private static RecordPageVisitCommand Command(
        string path = "/library", string visitorId = "visitor-1", string sessionId = "session-1") =>
        new(null, path, null, visitorId, sessionId, "Chrome", "toto-study.com");

    [Fact]
    public void Valid_Beacon_Passes() => Assert.True(_validator.Validate(Command()).IsValid);

    [Theory]
    [InlineData("")]
    [InlineData("library")]                     // not site-relative
    [InlineData("https://elsewhere.test/page")] // an absolute URL is somebody else's page
    public void Rejects_APathThatIsNotOurs(string path)
        => Assert.False(_validator.Validate(Command(path: path)).IsValid);

    [Fact]
    public void Rejects_AMissingVisitorId()
        => Assert.False(_validator.Validate(Command(visitorId: "")).IsValid);

    [Fact]
    public void Rejects_AnOversizedSessionId()
        => Assert.False(_validator.Validate(Command(sessionId: new string('s', 65))).IsValid);
}
