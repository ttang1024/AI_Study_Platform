using StudyPlatform.Application.Language;
using Xunit;

namespace StudyPlatform.Tests.Language;

public class PronunciationScorerTests
{
    [Fact]
    public void PerfectAttempt_ScoresFull()
    {
        var result = PronunciationScorer.Score("el gato está en la mesa", "el gato está en la mesa");

        Assert.Equal(100, result.Score);
        Assert.All(result.Words, w => Assert.True(w.Correct));
    }

    [Fact]
    public void PunctuationAndCaseAreIgnored()
    {
        // Transcripts vary freely in both; marking them down would grade the recogniser, not the learner.
        var result = PronunciationScorer.Score("Where is the station?", "where is the station");

        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void MissingAccentsAreForgiven()
    {
        // Speech-to-text is inconsistent about diacritics even when pronunciation was correct.
        var result = PronunciationScorer.Score("el gato está en la mesa", "el gato esta en la mesa");

        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void OneWrongWord_IsMarkedAndScoredDown()
    {
        var result = PronunciationScorer.Score("the cat sat on the mat", "the cat sat on the hat");

        Assert.Equal(83, result.Score);
        Assert.False(result.Words.Last().Correct);
        Assert.Equal("mat", result.Words.Last().Word);
    }

    [Fact]
    public void MissedWord_IsMarkedIncorrect()
    {
        var result = PronunciationScorer.Score("je voudrais un café", "je voudrais café");

        Assert.Equal(75, result.Score);
        Assert.False(result.Words.Single(w => w.Word == "un").Correct);
    }

    [Fact]
    public void WrongOrder_DoesNotScoreFull()
    {
        // A set-intersection score would give this 100%. Word order is part of saying the sentence.
        var result = PronunciationScorer.Score("the cat sat", "sat cat the");

        Assert.True(result.Score < 100);
    }

    [Fact]
    public void ExtraWordsDoNotPenalise_OnlyMissingTargetWordsDo()
    {
        // A learner who adds filler still said every target word, in order.
        var result = PronunciationScorer.Score("hello world", "um hello uh world you know");

        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void SilentAttempt_ScoresZero()
    {
        var result = PronunciationScorer.Score("bonjour tout le monde", "");

        Assert.Equal(0, result.Score);
        Assert.All(result.Words, w => Assert.False(w.Correct));
    }

    [Fact]
    public void CompletelyDifferentAttempt_ScoresZero()
    {
        var result = PronunciationScorer.Score("guten morgen", "pizza delivery");

        Assert.Equal(0, result.Score);
    }

    [Fact]
    public void EmptyTarget_ScoresZeroWithoutThrowing()
    {
        var result = PronunciationScorer.Score("", "anything at all");

        Assert.Equal(0, result.Score);
        Assert.Empty(result.Words);
    }

    [Fact]
    public void RepeatedWords_AreMatchedPositionally()
    {
        // "the" appears twice in the target and twice in the attempt; both should match, and the
        // wrong word between them should not.
        var result = PronunciationScorer.Score("the big the small", "the huge the small");

        Assert.Equal(75, result.Score);
        Assert.False(result.Words[1].Correct);
    }

    [Fact]
    public void WordsAreReportedInTheirOriginalForm()
    {
        // The learner should see the phrase as written, not the normalized comparison form.
        var result = PronunciationScorer.Score("¿Dónde está?", "donde esta");

        Assert.Equal(new[] { "¿Dónde", "está?" }, result.Words.Select(w => w.Word));
    }
}
