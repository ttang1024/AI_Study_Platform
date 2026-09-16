using StudyPlatform.Application.Share.Preview;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class SharePreviewHtmlRendererTests
{
    private const string Shell = """
        <!doctype html>
        <html lang="en">
        	<head>
        		<title>Toto Study - AI Study Platform</title>
        		<link rel="canonical" href="https://toto-study.com/" />
        		<meta name="description" content="Turn any document…" />
        		<meta property="og:title" content="Toto Study - AI Study Platform" />
        		<meta
        			property="og:description"
        			content="Turn any document…" />
        		<meta name="twitter:title" content="Toto Study - AI Study Platform" />
        		<meta name="wechat:title" content="Toto Study - AI Study Platform" />
        		<meta name="image_src" content="https://toto-study.com/share.png" />
        		<meta name="theme-color" content="#0d9488" />
        		<link rel="manifest" href="/manifest.webmanifest" />
        		<script type="application/ld+json">
        			{ "@type": "SoftwareApplication" }
        		</script>
        	</head>
        	<body>
        		<div id="root"></div>
        		<!-- Mirrors the copy rendered by web/src/pages/LandingPage.tsx. -->
        		<noscript>
        			<h1>Toto Study — AI Study Platform</h1>
        		</noscript>
        		<script type="module" crossorigin src="/assets/index-a1b2c3.js"></script>
        	</body>
        </html>
        """;

    private readonly SharePreviewHtmlRenderer _renderer = new();

    private static SharePreview Preview(string? title = null, string? description = null) => new(
        Title: title ?? "13_gans.pdf",
        Description: description ?? "Generative Adversarial Networks.\n\nShared by Ting Tang · Summary, 9 flashcards",
        Url: "https://toto-study.com/share/3jSLWBdGx2MI",
        ImageUrl: "https://toto-study.com/share.png",
        ImageWidth: 1200,
        ImageHeight: 1200,
        PublishedAtIso: "2026-09-15T21:46:28.0000000Z");

    [Fact]
    public void Render_ReplacesTheLandingPageCardWithTheShareCard()
    {
        var html = _renderer.Render(Shell, Preview());

        Assert.Contains("""<meta property="og:title" content="13_gans.pdf" />""", html);
        Assert.Contains("""<meta property="og:url" content="https://toto-study.com/share/3jSLWBdGx2MI" />""", html);
        Assert.Contains("""<meta name="twitter:card" content="summary_large_image" />""", html);
        Assert.Contains("<title>13_gans.pdf · Toto Study</title>", html);
        Assert.Contains("""<link rel="canonical" href="https://toto-study.com/share/3jSLWBdGx2MI" />""", html);
        Assert.DoesNotContain("Toto Study - AI Study Platform", html);
        Assert.DoesNotContain("Turn any document", html);
        Assert.DoesNotContain("application/ld+json", html);
    }

    [Fact]
    public void Render_LeavesTheAppItselfIntact()
    {
        var html = _renderer.Render(Shell, Preview());

        Assert.Contains("""<script type="module" crossorigin src="/assets/index-a1b2c3.js"></script>""", html);
        Assert.Contains("""<div id="root"></div>""", html);
        Assert.Contains("""<link rel="manifest" href="/manifest.webmanifest" />""", html);
        Assert.Contains("""<meta name="theme-color" content="#0d9488" />""", html);
        Assert.Contains("</head>", html);
    }

    [Fact]
    public void Render_EmitsExactlyOneOfEachSocialTag()
    {
        var html = _renderer.Render(Shell, Preview());

        Assert.Equal(1, Occurrences(html, """property="og:title" """.TrimEnd()));
        Assert.Equal(1, Occurrences(html, """name="twitter:title" """.TrimEnd()));
        Assert.Equal(1, Occurrences(html, """name="description" """.TrimEnd()));
        Assert.Equal(1, Occurrences(html, "<title>"));
        Assert.Equal(1, Occurrences(html, "<noscript>"));
    }

    [Fact]
    public void Render_ReplacesTheLandingNoscriptWithTheShareText()
    {
        var html = _renderer.Render(Shell, Preview());

        Assert.DoesNotContain("Toto Study — AI Study Platform", html);
        Assert.DoesNotContain("LandingPage.tsx", html);
        Assert.Contains("<h1>13_gans.pdf</h1>", html);
        Assert.Contains("<p>Generative Adversarial Networks.</p>", html);
        Assert.Contains("<p>Shared by Ting Tang · Summary, 9 flashcards</p>", html);
    }

    [Fact]
    public void Render_EscapesTitlesAndDescriptionsThatCouldBreakOutOfTheTag()
    {
        var html = _renderer.Render(Shell, Preview(
            title: """Quotes " and <script>alert(1)</script>""",
            description: "Line one\nLine two & more"));

        Assert.DoesNotContain("<script>alert(1)</script>", html);
        Assert.Contains("&quot;", html);
        Assert.Contains("&lt;script&gt;", html);
        Assert.Contains("Line one&#10;Line two &amp; more", html);
    }

    [Fact]
    public void Render_OmitsThePublishedDateWhenThereIsNoShare()
    {
        var preview = Preview() with { PublishedAtIso = null };

        Assert.DoesNotContain("article:published_time", _renderer.Render(Shell, preview));
    }

    [Theory]
    [InlineData("")]
    [InlineData("nothing that looks like a document")]
    public void Render_WithoutAUsableShellFallsBackToTheStandalonePage(string shell)
    {
        var html = _renderer.Render(shell, Preview());

        Assert.StartsWith("<!doctype html>", html);
        Assert.Contains("""<meta property="og:title" content="13_gans.pdf" />""", html);
    }

    [Fact]
    public void RenderStandalone_IsASelfContainedCardWithAWayIntoTheApp()
    {
        var html = _renderer.RenderStandalone(Preview());

        Assert.StartsWith("<!doctype html>", html);
        Assert.Contains("</head>", html);
        Assert.Contains("""<meta property="og:description" """.TrimEnd(), html);
        Assert.Contains("""<a href="https://toto-study.com/share/3jSLWBdGx2MI">Open this on Toto Study</a>""", html);
    }

    private static int Occurrences(string haystack, string needle)
    {
        var count = 0;
        for (var i = haystack.IndexOf(needle, StringComparison.Ordinal); i >= 0; i = haystack.IndexOf(needle, i + 1, StringComparison.Ordinal))
            count++;
        return count;
    }
}
