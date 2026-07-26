using StudyPlatform.Application.Language;
using Xunit;

namespace StudyPlatform.Tests.Language;

public class SentenceMinerTests
{
    [Fact]
    public void BlanksTheTargetWordInPlace()
    {
        var cloze = SentenceMiner.BuildCloze("El gato duerme en la silla", "duerme");

        Assert.Equal("El gato {{duerme}} en la silla", cloze);
    }

    [Fact]
    public void MatchesRegardlessOfCase_ButKeepsTheOriginalSpelling()
    {
        // A word capitalised at the start of a sentence is still the same word, and the card should
        // show it as it appeared.
        var cloze = SentenceMiner.BuildCloze("Duerme el gato", "duerme");

        Assert.Equal("{{Duerme}} el gato", cloze);
    }

    [Fact]
    public void OnlyMatchesWholeWords()
    {
        // Blanking the "act" inside "practice" would produce a card nobody can answer.
        Assert.Null(SentenceMiner.BuildCloze("I practice every day", "act"));
    }

    [Fact]
    public void BlanksOnlyTheFirstOccurrence()
    {
        // Two blanks in one sentence give the answer away from the second gap's context.
        var cloze = SentenceMiner.BuildCloze("the cat saw the dog", "the");

        Assert.Equal("{{the}} cat saw the dog", cloze);
    }

    [Fact]
    public void WordNotPresent_IsNull()
    {
        Assert.Null(SentenceMiner.BuildCloze("El gato duerme", "corre"));
    }

    [Fact]
    public void HandlesPunctuationAdjacentToTheWord()
    {
        var cloze = SentenceMiner.BuildCloze("¿Dónde está el baño?", "baño");

        Assert.Equal("¿Dónde está el {{baño}}?", cloze);
    }

    [Fact]
    public void HandlesRegexMetacharactersInTheTarget()
    {
        // A learner mining "C++" must not blow up the regex.
        var cloze = SentenceMiner.BuildCloze("We wrote it in C++ back then", "C++");

        Assert.Equal("We wrote it in {{C++}} back then", cloze);
    }

    [Theory]
    [InlineData("", "word")]
    [InlineData("a sentence", "")]
    [InlineData("   ", "word")]
    public void EmptyInputs_AreNull(string sentence, string word)
    {
        Assert.Null(SentenceMiner.BuildCloze(sentence, word));
    }
}
