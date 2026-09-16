using StudyPlatform.Application.Share.Preview;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class SharePreviewFactoryTests
{
    private const string Origin = "https://toto-study.com";

    private readonly SharePreviewFactory _factory = new(new SummarySnippetExtractor(), new ShareContentsInventory());

    [Fact]
    public void Create_BuildsTheCardFromTheShare()
    {
        var share = new ShareToken
        {
            Token = "3jSLWBdGx2MI",
            Title = "13_gans.pdf",
            Summary = "Generative Adversarial Networks (GANs) represent a highly influential class of latent variable models.",
            MindMapText = "# GANs",
            FlashcardsJson = "[{},{},{}]",
            CreatedAt = new DateTime(2026, 9, 15, 21, 46, 28, DateTimeKind.Utc),
            Owner = new User { FullName = "Ting Tang" },
        };

        var preview = _factory.Create(share, Origin);

        Assert.Equal("13_gans.pdf", preview.Title);
        Assert.Equal("https://toto-study.com/share/3jSLWBdGx2MI", preview.Url);
        Assert.Equal("https://toto-study.com/share.png", preview.ImageUrl);
        Assert.StartsWith("Generative Adversarial Networks (GANs) represent", preview.Description);
        Assert.EndsWith("Shared by Ting Tang · Summary, mind map, 3 flashcards", preview.Description);
        Assert.Contains("2026-09-15", preview.PublishedAtIso);
    }

    [Fact]
    public void Create_WithoutASummaryFallsBackToTheAttributionLine()
    {
        var share = new ShareToken
        {
            Token = "abc",
            Title = "Deck only",
            FlashcardsJson = "[{},{}]",
            Owner = new User { FullName = "Ting Tang" },
        };

        Assert.Equal("Shared by Ting Tang · 2 flashcards", _factory.Create(share, Origin).Description);
    }

    [Fact]
    public void Create_WithNothingToListStillNamesTheSharer()
    {
        var share = new ShareToken { Token = "abc", Title = "Empty", Owner = new User { FullName = "Ting Tang" } };

        Assert.Equal("Shared by Ting Tang on toto.ai", _factory.Create(share, Origin).Description);
    }

    [Fact]
    public void Create_WithoutAnOwnerNameStaysAnonymous()
    {
        var share = new ShareToken { Token = "abc", Title = "Anon", Summary = "Body." };

        Assert.EndsWith("Shared by a toto.ai user · Summary", _factory.Create(share, Origin).Description);
    }

    [Fact]
    public void Create_TrimsATrailingSlashFromTheOrigin()
    {
        var preview = _factory.Create(new ShareToken { Token = "abc", Title = "T" }, "https://toto-study.com/");

        Assert.Equal("https://toto-study.com/share/abc", preview.Url);
    }

    [Fact]
    public void Create_ShortensAnOverlongTitle()
    {
        var share = new ShareToken { Token = "abc", Title = string.Join(" ", Enumerable.Repeat("title", 50)) };

        var preview = _factory.Create(share, Origin);

        Assert.True(preview.Title.Length <= 111, $"title was {preview.Title.Length} chars");
        Assert.EndsWith("…", preview.Title);
    }

    [Fact]
    public void Create_UntitledShareStillHasAHeadline()
    {
        Assert.Equal("Shared study material", _factory.Create(new ShareToken { Token = "abc", Title = "  " }, Origin).Title);
    }

    [Fact]
    public void CreateUnavailable_SaysTheLinkIsGoneWithoutDescribingIt()
    {
        var preview = _factory.CreateUnavailable("gone", Origin);

        Assert.Equal("Shared study material", preview.Title);
        Assert.StartsWith("This share link has expired", preview.Description);
        Assert.Equal("https://toto-study.com/share/gone", preview.Url);
        Assert.Null(preview.PublishedAtIso);
    }
}
