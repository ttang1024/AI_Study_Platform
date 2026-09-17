using StudyPlatform.Application.Analytics;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class PageVisitPathTests
{
    [Theory]
    [InlineData("/library", "/library")]
    [InlineData("/", "/")]
    [InlineData("", "/")]
    [InlineData(null, "/")]
    [InlineData("/Library", "/library")]                 // case folded so one page is one row
    [InlineData("/library/", "/library")]                // trailing slash is the same page
    [InlineData("/library?type=videos#top", "/library")] // query and fragment are not the page
    [InlineData("/library/add", "/library/add")]
    public void Normalize_KeepsRouteNames(string? raw, string expected)
        => Assert.Equal(expected, PageVisitTelemetry.NormalizePath(raw));

    [Theory]
    [InlineData("/documents/0f8fad5b-d9cb-469f-a165-70867728950e", "/documents/:id")]
    [InlineData("/videos/12345", "/videos/:id")]
    [InlineData("/courses/0f8fad5b-d9cb-469f-a165-70867728950e/study", "/courses/:id/study")]
    [InlineData("/documents/aBc123XyZ987qWeRtY45", "/documents/:id")] // long opaque token
    public void Normalize_CollapsesIdentifyingSegments(string raw, string expected)
        => Assert.Equal(expected, PageVisitTelemetry.NormalizePath(raw));

    [Theory]
    [InlineData("/share/abc123", "/share/:token")]
    [InlineData("/share/SHORT", "/share/:token")] // a share token is a credential at any length
    public void Normalize_AlwaysMasksShareTokens(string raw, string expected)
        => Assert.Equal(expected, PageVisitTelemetry.NormalizePath(raw));

    [Fact]
    public void Normalize_AcceptsAnAbsoluteUrl()
        => Assert.Equal("/library", PageVisitTelemetry.NormalizePath("https://toto-study.com/library?x=1"));

    [Fact]
    public void Normalize_TruncatesToTheColumnWidth()
    {
        var deep = "/" + string.Join("/", Enumerable.Repeat(new string('a', 60), 10));

        var result = PageVisitTelemetry.NormalizePath(deep);

        Assert.True(result.Length <= PageVisitTelemetry.MaxPathLength);
    }
}

public class PageVisitReferrerTests
{
    [Fact]
    public void Normalize_KeepsOnlyTheHost()
        => Assert.Equal("news.ycombinator.com",
            PageVisitTelemetry.NormalizeReferrer("https://news.ycombinator.com/item?id=1", "toto-study.com"));

    [Fact]
    public void Normalize_DropsOwnSiteBecauseInternalNavigationIsAlreadyAVisit()
        => Assert.Null(PageVisitTelemetry.NormalizeReferrer("https://toto-study.com/dashboard", "toto-study.com"));

    [Fact]
    public void Normalize_DropsOwnSiteWhenTheHostHeaderCarriesAPort()
        => Assert.Null(PageVisitTelemetry.NormalizeReferrer("http://localhost/login", "localhost:3000"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-url")]
    public void Normalize_DropsWhatIsNotAUrl(string? referrer)
        => Assert.Null(PageVisitTelemetry.NormalizeReferrer(referrer, "toto-study.com"));
}

public class PageVisitDeviceTests
{
    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "mobile")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36", "mobile")]
    [InlineData("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "tablet")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-X700) AppleWebKit/537.36 Safari/537.36", "tablet")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36", "desktop")]
    [InlineData("", "unknown")]
    [InlineData(null, "unknown")]
    public void Classify_SortsTheThreeShapesOfBrowser(string? userAgent, string expected)
        => Assert.Equal(expected, PageVisitTelemetry.ClassifyDevice(userAgent));
}

public class PageVisitBotTests
{
    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("facebookexternalhit/1.1")]
    [InlineData("Twitterbot/1.0")]
    [InlineData("curl/8.4.0")]
    [InlineData("Mozilla/5.0 HeadlessChrome/128.0.0.0")]
    public void IsBot_CatchesTheCrawlersThatHitShareLinks(string userAgent)
        => Assert.True(PageVisitTelemetry.IsBot(userAgent));

    [Theory]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1")]
    [InlineData("")]
    [InlineData(null)]
    public void IsBot_LeavesRealBrowsersAlone(string? userAgent)
        => Assert.False(PageVisitTelemetry.IsBot(userAgent));
}
