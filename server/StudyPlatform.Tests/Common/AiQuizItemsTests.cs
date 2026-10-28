using System.Text.Json;
using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class AiQuizItemsTests
{
    private const string Good = """{"question":"2+2?","options":["3","4"],"correctAnswer":"4","explanation":"sum"}""";

    [Fact]
    public void BareArray_Parses()
        => Assert.Equal("2+2?", Assert.Single(AiQuizItems.Parse($"[{Good}]")).Question);

    [Fact]
    public void ArrayInsideAWrapperObject_Parses()
        => Assert.Single(AiQuizItems.Parse($$"""{"questions":[{{Good}}]}"""));

    [Fact]
    public void ItemsMissingRequiredFields_AreDropped()
    {
        // Each of these used to reach the database (NOT NULL) or answer normalisation (null.Trim()) and 500.
        var json = $$"""
            [
              {{Good}},
              {"options":["a","b"],"correctAnswer":"a"},
              {"question":"No answer","options":["a","b"]},
              {"question":"One option","options":["a"],"correctAnswer":"a"},
              {"question":"No explanation","options":["a","b"],"correctAnswer":"a"}
            ]
            """;

        var items = AiQuizItems.Parse(json);

        Assert.Equal(["2+2?", "No explanation"], items.Select(i => i.Question));
        Assert.Equal(string.Empty, items[1].Explanation);
    }

    [Theory]
    [InlineData("""{"note":"no array here"}""")]
    [InlineData("""[{"question":"","options":["a","b"],"correctAnswer":"a"}]""")]
    [InlineData("""not json""")]
    public void NothingUsable_Throws(string json)
        => Assert.ThrowsAny<JsonException>(() => AiQuizItems.Parse(json));
}
