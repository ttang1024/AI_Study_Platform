using StudyPlatform.Application.Share.Preview;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class SummarySnippetExtractorTests
{
    private readonly SummarySnippetExtractor _extractor = new();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \n\n  ")]
    public void Extract_WithoutUsableText_ReturnsEmpty(string? markdown)
    {
        Assert.Equal(string.Empty, _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_TakesFirstParagraphAndStopsAtBlankLine()
    {
        var markdown = "First paragraph of the summary.\nStill the first paragraph.\n\nSecond paragraph.";

        Assert.Equal("First paragraph of the summary. Still the first paragraph.", _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_SkipsLeadingHeadingsAndRules()
    {
        var markdown = "# Overview\n\n---\n\nGenerative adversarial networks are latent variable models.";

        Assert.Equal("Generative adversarial networks are latent variable models.", _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_RemovesInlineMarkup()
    {
        var markdown = "A **bold** claim with `code`, a [link](https://example.com) and an ![image](a.png).";

        Assert.Equal("A bold claim with code, a link and an .", _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_DropsFencedCodeBlocks()
    {
        var markdown = "```python\nprint('hi')\n```\n\nThe model is trained adversarially.";

        Assert.Equal("The model is trained adversarially.", _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_FallsBackToBulletsWhenThereIsNoProse()
    {
        var markdown = "## Key points\n\n- Mode collapse\n- Training instability";

        Assert.Equal("Mode collapse Training instability", _extractor.Extract(markdown, 180));
    }

    [Fact]
    public void Extract_TruncatesOnAWordBoundaryWithAnEllipsis()
    {
        var snippet = _extractor.Extract("Optimizing the performance of AI agents requires structured methods.", 30);

        Assert.EndsWith("…", snippet);
        Assert.True(snippet.Length <= 31, $"snippet was {snippet.Length} chars: {snippet}");
        Assert.StartsWith("Optimizing the performance", snippet);
        Assert.DoesNotContain("requires", snippet);
    }

    [Fact]
    public void Extract_ShorterThanTheLimitIsLeftWhole()
    {
        Assert.Equal("Short summary.", _extractor.Extract("Short summary.", 180));
    }

    [Fact]
    public void Extract_CollapsesWhitespace()
    {
        Assert.Equal("One two three", _extractor.Extract("One   two\tthree", 180));
    }
}
