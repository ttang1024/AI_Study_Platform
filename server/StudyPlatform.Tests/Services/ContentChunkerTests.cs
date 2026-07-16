using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class ContentChunkerTests
{
    [Fact]
    public void Chunk_EmptyText_ReturnsNothing()
    {
        Assert.Empty(ContentChunker.Chunk(""));
        Assert.Empty(ContentChunker.Chunk("   \n\n  "));
    }

    [Fact]
    public void Chunk_ShortText_StaysWhole()
    {
        var chunks = ContentChunker.Chunk("A short paragraph about mitochondria.");

        Assert.Single(chunks);
        Assert.Equal("A short paragraph about mitochondria.", chunks[0]);
    }

    [Fact]
    public void Chunk_PacksParagraphsUpToTheTarget()
    {
        var paragraph = new string('a', 400);
        var text = string.Join("\n\n", Enumerable.Repeat(paragraph, 6));

        var chunks = ContentChunker.Chunk(text, targetChars: 1000, overlapChars: 0);

        Assert.True(chunks.Count > 1);
        Assert.All(chunks, c => Assert.True(c.Length <= 1000, $"chunk was {c.Length} chars"));
    }

    /// <summary>
    /// A paragraph longer than the whole target can't be packed with anything — it has to be split on
    /// its own, or it would blow the chunk budget.
    /// </summary>
    [Fact]
    public void Chunk_SplitsAnOverlongParagraph()
    {
        var sentence = "This is a sentence about cellular respiration. ";
        var text = string.Concat(Enumerable.Repeat(sentence, 100));

        var chunks = ContentChunker.Chunk(text, targetChars: 500, overlapChars: 50);

        Assert.True(chunks.Count > 1);
        Assert.All(chunks, c => Assert.True(c.Length <= 500, $"chunk was {c.Length} chars"));
    }

    /// <summary>
    /// The overlap is the whole point of chunking this way: a passage that straddles a boundary must
    /// still appear intact in one of the chunks, or it matches no query well.
    /// </summary>
    [Fact]
    public void Chunk_CarriesOverlapIntoTheNextChunk()
    {
        var first = new string('a', 900);
        var second = new string('b', 900);
        var text = $"{first}\n\n{second}";

        var chunks = ContentChunker.Chunk(text, targetChars: 1000, overlapChars: 100);

        Assert.Equal(2, chunks.Count);

        // The second chunk should open with a tail of the first, not cold at the 'b's.
        Assert.StartsWith("a", chunks[1]);
        Assert.Contains("b", chunks[1]);
    }

    [Fact]
    public void Chunk_FoldsARuntTrailingChunkIntoItsNeighbour()
    {
        var body = new string('a', 950);
        var text = $"{body}\n\nend.";

        var chunks = ContentChunker.Chunk(text, targetChars: 1000, overlapChars: 0);

        Assert.Single(chunks);
        Assert.EndsWith("end.", chunks[0]);
    }

    [Fact]
    public void Chunk_DropsBlankParagraphs()
    {
        var chunks = ContentChunker.Chunk("First.\n\n\n\n   \n\nSecond.");

        Assert.Single(chunks);
        Assert.Equal("First.\n\nSecond.", chunks[0]);
    }
}
