using StudyPlatform.Application.Practice.Queries;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class PracticeFlashcardFormatToPromptAnswerTests
{
    [Fact]
    public void ToPromptAnswer_NoClozeAndNoBack_ReturnsNull()
    {
        Assert.Null(PracticeFlashcardFormat.ToPromptAnswer("Plain question", null));
        Assert.Null(PracticeFlashcardFormat.ToPromptAnswer("Plain question", "   "));
    }

    [Fact]
    public void ToPromptAnswer_NoCloze_UsesFrontAndBackVerbatim()
    {
        var result = PracticeFlashcardFormat.ToPromptAnswer("What is 2+2?", "4");

        Assert.Equal(("What is 2+2?", "4"), result);
    }

    [Fact]
    public void ToPromptAnswer_ClozeWithNoBack_UsesTermsAsAnswer()
    {
        var result = PracticeFlashcardFormat.ToPromptAnswer("The capital of France is {{Paris}}.", null);

        Assert.Equal("The capital of France is _____.", result!.Value.Prompt);
        Assert.Equal("Paris", result.Value.Answer);
    }

    [Fact]
    public void ToPromptAnswer_ClozeWithBack_CombinesTermsAndBack()
    {
        var result = PracticeFlashcardFormat.ToPromptAnswer("{{Mitosis}} splits a cell.", "Cell division process");

        Assert.Equal("Mitosis — Cell division process", result!.Value.Answer);
    }

    [Fact]
    public void ToPromptAnswer_MultipleClozeTerms_JoinsWithComma()
    {
        var result = PracticeFlashcardFormat.ToPromptAnswer("{{A}} and {{B}} are constants.", null);

        Assert.Equal("A, B", result!.Value.Answer);
        Assert.Equal("_____ and _____ are constants.", result.Value.Prompt);
    }

    [Fact]
    public void ToPromptAnswer_TrimsWhitespaceInClozeTerm()
    {
        var result = PracticeFlashcardFormat.ToPromptAnswer("{{  Paris  }} is a city.", null);

        Assert.Equal("Paris", result!.Value.Answer);
    }
}
