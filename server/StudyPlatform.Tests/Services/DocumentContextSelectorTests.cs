using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class DocumentContextSelectorTests
{
    private static string Filler(int paragraphs, string topic)
        => string.Join("\n\n", Enumerable.Range(0, paragraphs).Select(i =>
            $"Paragraph {i} discusses {topic} in general terms, covering background material and context that is "
            + "useful for orientation but not specific to any particular question a reader might ask later on."));

    [Fact]
    public void ShortDocument_IsSentWhole()
    {
        const string doc = "A short document about photosynthesis.";
        Assert.Equal(doc, DocumentContextSelector.Select(doc, "what is photosynthesis?"));
    }

    [Fact]
    public void LongDocument_KeepsThePassageTheQuestionIsAbout_EvenFarFromTheStart()
    {
        const string answer = "The Krebs cycle produces NADH and FADH2 inside the mitochondrial matrix.";
        var doc = "Introduction to cell biology.\n\n" + Filler(150, "cell structure")
            + "\n\n" + answer + "\n\n" + Filler(150, "membrane transport");

        var context = DocumentContextSelector.Select(doc, "Where does the Krebs cycle happen and what does it produce?");

        Assert.Contains("Krebs cycle produces NADH", context);
        Assert.StartsWith("Introduction to cell biology.", context); // the opening is always kept
        Assert.True(context.Length <= DocumentContextSelector.DefaultBudgetChars + 64);
    }

    [Fact]
    public void LongDocument_MarksOmittedStretches()
    {
        var doc = Filler(400, "history");
        var context = DocumentContextSelector.Select(doc, "nothing in particular");

        Assert.Contains("[…]", context);
        Assert.True(context.Length < doc.Length);
    }
}
