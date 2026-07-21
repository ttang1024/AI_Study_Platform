using StudyPlatform.Application.ConceptLinks;
using Xunit;

namespace StudyPlatform.Tests.ConceptLinks;

public class ConceptMatcherTests
{
    private static ConceptMatcher Build(params (string Phrase, string ConceptId)[] concepts)
        => new(concepts.ToDictionary(c => c.Phrase, c => c.ConceptId));

    [Fact]
    public void FindConcepts_MatchesCaseInsensitiveSubstring()
    {
        var matcher = Build(("Mitochondria", "concept:mitochondria"));

        var found = matcher.FindConcepts("The MITOCHONDRIA is the powerhouse of the cell.").ToList();

        Assert.Equal(new[] { "concept:mitochondria" }, found);
    }

    [Fact]
    public void FindConcepts_MatchesEvenWithoutWordBoundaries_LikeOriginalContainsCheck()
    {
        // Preserves the original `text.Contains(concept, OrdinalIgnoreCase)` semantics: a substring
        // hit inside a larger word still counts, not just whole-word matches.
        var matcher = Build(("cell", "concept:cell"));

        var found = matcher.FindConcepts("Cellular respiration happens here.").ToList();

        Assert.Equal(new[] { "concept:cell" }, found);
    }

    [Fact]
    public void FindConcepts_ReturnsEachConceptAtMostOnce_EvenWithRepeatedOccurrences()
    {
        var matcher = Build(("photosynthesis", "concept:photosynthesis"));

        var found = matcher.FindConcepts("Photosynthesis. More on photosynthesis: photosynthesis is key.").ToList();

        Assert.Single(found);
        Assert.Equal("concept:photosynthesis", found[0]);
    }

    [Fact]
    public void FindConcepts_MatchesMultipleOverlappingAndDistinctConcepts()
    {
        var matcher = Build(
            ("cell", "concept:cell"),
            ("cell membrane", "concept:cell-membrane"),
            ("mitosis", "concept:mitosis"));

        var found = matcher.FindConcepts("The cell membrane controls what enters during mitosis.").ToList();

        Assert.Equal(new HashSet<string> { "concept:cell", "concept:cell-membrane", "concept:mitosis" }, found.ToHashSet());
    }

    [Fact]
    public void FindConcepts_SkipsPatternsShorterThanThreeChars()
    {
        var matcher = Build(("pH", "concept:ph"));

        var found = matcher.FindConcepts("The pH of the solution was measured.").ToList();

        Assert.Empty(found);
    }

    [Fact]
    public void FindConcepts_ReturnsNothing_ForNullOrEmptyText()
    {
        var matcher = Build(("mitosis", "concept:mitosis"));

        Assert.Empty(matcher.FindConcepts(null));
        Assert.Empty(matcher.FindConcepts(""));
        Assert.Empty(matcher.FindConcepts("   "));
    }

    [Fact]
    public void FindConcepts_ReturnsNothing_WhenNoConceptAppears()
    {
        var matcher = Build(("mitosis", "concept:mitosis"), ("meiosis", "concept:meiosis"));

        var found = matcher.FindConcepts("This text discusses unrelated topics entirely.").ToList();

        Assert.Empty(found);
    }
}
