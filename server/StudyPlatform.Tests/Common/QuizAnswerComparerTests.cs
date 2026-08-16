using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class QuizAnswerComparerTests
{
    [Theory]
    [InlineData(null, "A")]
    [InlineData("A", null)]
    [InlineData("", "A")]
    [InlineData("  ", "A")]
    public void IsCorrect_NullOrBlankInputs_ReturnsFalse(string? option, string? answer)
    {
        Assert.False(QuizAnswerComparer.IsCorrect(option, answer));
    }

    [Fact]
    public void IsCorrect_ExactTextMatch_ReturnsTrue()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("Paris", "Paris"));
    }

    [Fact]
    public void IsCorrect_CaseAndWhitespaceInsensitive_ReturnsTrue()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("  Paris  ", "paris"));
        Assert.True(QuizAnswerComparer.IsCorrect("New   York", "new york"));
    }

    [Fact]
    public void IsCorrect_BareOptionLetterMatchesLetterPrefixedOption()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("B) Paris", "B"));
        Assert.True(QuizAnswerComparer.IsCorrect("B", "b"));
    }

    [Fact]
    public void IsCorrect_DifferentLetters_ReturnsFalse()
    {
        Assert.False(QuizAnswerComparer.IsCorrect("B) Paris", "C"));
    }

    [Fact]
    public void IsCorrect_TextWithDifferentLetterPrefix_MatchesOnBody()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("A) Paris", "B) Paris"));
    }

    [Fact]
    public void IsCorrect_SemanticEquivalence_AmpersandVsAnd()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("Rock & Roll", "Rock and Roll"));
    }

    [Fact]
    public void IsCorrect_SemanticEquivalence_TrailingPunctuationIgnored()
    {
        Assert.True(QuizAnswerComparer.IsCorrect("Photosynthesis!", "Photosynthesis"));
    }

    [Fact]
    public void IsCorrect_CompletelyDifferentAnswers_ReturnsFalse()
    {
        Assert.False(QuizAnswerComparer.IsCorrect("Paris", "London"));
    }

    [Fact]
    public void IsCorrect_BareLetterAgainstBareDifferentLetter_ReturnsFalse()
    {
        Assert.False(QuizAnswerComparer.IsCorrect("A", "B"));
    }
}

public class ConfidenceLevelTests
{
    [Theory]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, true)]
    [InlineData(0, false)]
    [InlineData(4, false)]
    [InlineData(-1, false)]
    public void IsValid_ChecksRange(int level, bool expected)
    {
        Assert.Equal(expected, ConfidenceLevel.IsValid(level));
    }

    [Theory]
    [InlineData(1, "Guessing")]
    [InlineData(2, "Unsure")]
    [InlineData(3, "Confident")]
    [InlineData(99, "Unknown")]
    public void Label_ReturnsExpectedString(int level, string expected)
    {
        Assert.Equal(expected, ConfidenceLevel.Label(level));
    }
}

public class ConfidenceSerializerTests
{
    [Fact]
    public void Serialize_NullOrEmpty_ReturnsNull()
    {
        Assert.Null(ConfidenceSerializer.Serialize(null));
        Assert.Null(ConfidenceSerializer.Serialize(new Dictionary<string, int>()));
    }

    [Fact]
    public void Serialize_DropsInvalidLevels()
    {
        var input = new Dictionary<string, int> { ["q1"] = 3, ["q2"] = 7 };

        var json = ConfidenceSerializer.Serialize(input);

        Assert.NotNull(json);
        Assert.Contains("q1", json);
        Assert.DoesNotContain("q2", json);
    }

    [Fact]
    public void Serialize_AllInvalid_ReturnsNull()
    {
        var input = new Dictionary<string, int> { ["q1"] = 99 };

        Assert.Null(ConfidenceSerializer.Serialize(input));
    }

    [Fact]
    public void Deserialize_NullOrWhitespace_ReturnsEmpty()
    {
        Assert.Empty(ConfidenceSerializer.Deserialize(null));
        Assert.Empty(ConfidenceSerializer.Deserialize("  "));
    }

    [Fact]
    public void Deserialize_MalformedJson_ReturnsEmpty()
    {
        Assert.Empty(ConfidenceSerializer.Deserialize("{not valid"));
    }

    [Fact]
    public void Deserialize_RoundTripsWithSerialize()
    {
        var input = new Dictionary<string, int> { ["q1"] = 3, ["q2"] = 1 };
        var json = ConfidenceSerializer.Serialize(input);

        var result = ConfidenceSerializer.Deserialize(json);

        Assert.Equal(2, result.Count);
        Assert.Equal(3, result["q1"]);
    }
}

public class QuizDifficultyTests
{
    [Theory]
    [InlineData("easy", "easy")]
    [InlineData("EASY", "easy")]
    [InlineData("hard", "hard")]
    [InlineData("HARD", "hard")]
    [InlineData("medium", "medium")]
    [InlineData("unknown", "medium")]
    [InlineData("", "medium")]
    public void Normalize_MapsToKnownDifficulty(string input, string expected)
    {
        Assert.Equal(expected, QuizDifficulty.Normalize(input));
    }

    [Theory]
    [InlineData("adaptive", true)]
    [InlineData("ADAPTIVE", true)]
    [InlineData("easy", false)]
    [InlineData("", false)]
    public void IsAdaptive_ChecksCaseInsensitively(string input, bool expected)
    {
        Assert.Equal(expected, QuizDifficulty.IsAdaptive(input));
    }
}
