using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class SourceAnchorResolverTests
{
    private const string Source = """
        The mitochondrion is a double-membrane organelle found in most eukaryotic cells.
        It generates most of the cell's supply of adenosine triphosphate, used as a source
        of chemical energy. Mitochondria contain their own genome, which is separate from
        the nuclear genome and is inherited maternally in most species.
        """;

    [Fact]
    public void Resolve_ExactQuote_ReturnsOffsetsThatSpanTheQuote()
    {
        var anchor = SourceAnchorResolver.Resolve(Source, "double-membrane organelle found in most eukaryotic cells");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);

        var located = Source[anchor.StartOffset!.Value..anchor.EndOffset!.Value];
        Assert.Contains("double-membrane organelle", located);
    }

    [Fact]
    public void Resolve_ExactQuote_SpanIsTheQuoteAndNothingMore()
    {
        // Pinned exactly, not with Contains: the offsets drive a highlight in the source view, and an
        // end offset that runs one character long is invisible to a containment assertion.
        const string quote = "double-membrane organelle found in most eukaryotic cells";

        var anchor = SourceAnchorResolver.Resolve(Source, quote);

        Assert.NotNull(anchor);
        Assert.Equal(quote, Source[anchor!.StartOffset!.Value..anchor.EndOffset!.Value]);
    }

    [Fact]
    public void Resolve_QuoteEndingBeforeCollapsedWhitespace_DoesNotOvershoot()
    {
        // The worst case for the offset mapping: the character after the match is a line break that
        // normalization collapses, so a naive "map the index past the match" lands well past the quote.
        const string quote = "used as a source";

        var anchor = SourceAnchorResolver.Resolve(Source, quote);

        Assert.NotNull(anchor);
        Assert.Equal(quote, Source[anchor!.StartOffset!.Value..anchor.EndOffset!.Value]);
    }

    [Fact]
    public void Resolve_QuoteWithCollapsedWhitespace_StillMatches()
    {
        // The source wraps this across a line break; the model echoes it as one line.
        var anchor = SourceAnchorResolver.Resolve(
            Source, "It generates most of the cell's supply of adenosine triphosphate");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);
    }

    [Fact]
    public void Resolve_QuoteWithCurlyApostrophe_StillMatches()
    {
        // Models routinely straighten or curl quotes relative to the extracted PDF text.
        var anchor = SourceAnchorResolver.Resolve(Source, "most of the cell’s supply of adenosine triphosphate");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);
    }

    [Fact]
    public void Resolve_DifferentCase_StillMatches()
    {
        var anchor = SourceAnchorResolver.Resolve(Source, "MITOCHONDRIA CONTAIN THEIR OWN GENOME");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);
    }

    [Fact]
    public void Resolve_QuoteWithOneRewordedWord_StillMatches()
    {
        // "found within most eukaryotic cells" vs. the source's "found in most eukaryotic cells".
        var anchor = SourceAnchorResolver.Resolve(
            Source, "a double-membrane organelle found within most eukaryotic cells");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);
    }

    [Fact]
    public void Resolve_HallucinatedQuote_ReturnsNull()
    {
        // This is the case that matters most: the model invents a plausible-sounding sentence that
        // is not in the source. Anchoring it anywhere would be a fabricated citation.
        var anchor = SourceAnchorResolver.Resolve(
            Source, "The Golgi apparatus packages proteins into vesicles for secretion elsewhere");

        Assert.Null(anchor);
    }

    [Fact]
    public void Resolve_QuoteSharingOnlyStopwords_ReturnsNull()
    {
        var anchor = SourceAnchorResolver.Resolve(Source, "of the and in most of the is a to the from");

        Assert.Null(anchor);
    }

    [Fact]
    public void Resolve_ShortQuote_ReturnsNull()
    {
        // Too little signal to place uniquely, even though it does occur in the source.
        Assert.Null(SourceAnchorResolver.Resolve(Source, "genome"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_EmptyInputs_ReturnNull(string? quote)
    {
        Assert.Null(SourceAnchorResolver.Resolve(Source, quote));
        Assert.Null(SourceAnchorResolver.Resolve(quote, "double-membrane organelle found in cells"));
    }

    [Fact]
    public void ResolveWithPages_AttributesTheMatchToItsPage()
    {
        var text = new string('a', 100) + " chemical energy is released by respiration " + new string('b', 100);
        var pageStarts = new[] { 0, 90, 200 };

        var anchor = SourceAnchorResolver.ResolveWithPages(
            text, "chemical energy is released by respiration", pageStarts);

        Assert.NotNull(anchor);
        Assert.Equal(2, anchor!.Page);
    }

    [Fact]
    public void ResolveWithPages_UnlocatedQuote_HasNoPage()
    {
        var anchor = SourceAnchorResolver.ResolveWithPages(
            Source, "an entirely invented statement about ribosomal assembly lines", new[] { 0, 50 });

        Assert.Null(anchor);
    }

    [Fact]
    public void ResolveWithTimestamps_AttributesTheMatchToItsSegment()
    {
        var transcript = "welcome back everyone. today we cover the krebs cycle in detail. any questions?";
        var segments = new List<(double, int)> { (0d, 0), (12.5d, 23), (60d, 63) };

        var anchor = SourceAnchorResolver.ResolveWithTimestamps(
            transcript, "today we cover the krebs cycle in detail", segments);

        Assert.NotNull(anchor);
        Assert.Equal(12.5d, anchor!.StartSeconds);
    }

    [Fact]
    public void RoundTrip_SerializesAndDeserializes()
    {
        var original = new SourceAnchor("a quoted span", 10, 23, 4, 88.5);

        var restored = SourceAnchorResolver.Deserialize(SourceAnchorResolver.Serialize(original));

        Assert.Equal(original, restored);
    }

    [Fact]
    public void Deserialize_Garbage_ReturnsNullRatherThanThrowing()
    {
        Assert.Null(SourceAnchorResolver.Deserialize("{not json"));
        Assert.Null(SourceAnchorResolver.Deserialize(null));
        Assert.Null(SourceAnchorResolver.Deserialize(""));
    }
}
