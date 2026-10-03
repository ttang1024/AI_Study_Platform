using StudyPlatform.Application.Practice.Queries;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class PracticeFlashcardFormatTests
{
    [Fact]
    public void BasicCard_UsesFrontAndBackAsIs()
    {
        var qa = PracticeFlashcardFormat.ToPromptAnswer("What is an autoencoder?", "A network that learns to compress and reconstruct its input.");

        Assert.NotNull(qa);
        Assert.Equal("What is an autoencoder?", qa!.Value.Prompt);
        Assert.Equal("A network that learns to compress and reconstruct its input.", qa.Value.Answer);
    }

    [Fact]
    public void ClozeCard_BlanksTermInPrompt_AndSurfacesItAsAnswer()
    {
        var qa = PracticeFlashcardFormat.ToPromptAnswer(
            "The first half of an autoencoder is known as the {{encoder}}.", "");

        Assert.NotNull(qa);
        Assert.Equal("The first half of an autoencoder is known as the _____.", qa!.Value.Prompt);
        Assert.Equal("encoder", qa.Value.Answer);
    }

    [Fact]
    public void ClozeCard_WithMultipleTerms_JoinsAnswers()
    {
        var qa = PracticeFlashcardFormat.ToPromptAnswer("{{Encoder}} compresses, {{decoder}} reconstructs.", null);

        Assert.NotNull(qa);
        Assert.Equal("_____ compresses, _____ reconstructs.", qa!.Value.Prompt);
        Assert.Equal("Encoder, decoder", qa.Value.Answer);
    }

    [Fact]
    public void ClozeCard_WithBack_AppendsBackToAnswer()
    {
        var qa = PracticeFlashcardFormat.ToPromptAnswer("The {{mitochondria}} makes ATP.", "Also called the powerhouse of the cell.");

        Assert.NotNull(qa);
        Assert.Equal("mitochondria — Also called the powerhouse of the cell.", qa!.Value.Answer);
    }

    [Fact]
    public void CardWithNoAnswer_IsSkipped()
    {
        Assert.Null(PracticeFlashcardFormat.ToPromptAnswer("A front with no back and no cloze.", "  "));
    }
}
