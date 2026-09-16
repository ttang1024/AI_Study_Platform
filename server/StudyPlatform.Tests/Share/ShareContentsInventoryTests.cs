using StudyPlatform.Application.Share.Preview;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class ShareContentsInventoryTests
{
    private readonly ShareContentsInventory _inventory = new();

    [Fact]
    public void Describe_ListsEverythingTheShareHolds()
    {
        var share = new ShareToken
        {
            Title = "GANs",
            Summary = "A summary",
            MindMapText = "# root",
            NotesHtml = "<p>notes</p>",
            FlashcardsJson = Items(9),
            QuizzesJson = Items(3),
            GlossaryJson = Items(4),
        };

        Assert.Equal(
            "Summary, mind map, notes, 9 flashcards, 3 quiz questions, 4 glossary terms",
            _inventory.Describe(share));
    }

    [Fact]
    public void Describe_UsesConversationWordingForChatShares()
    {
        var share = new ShareToken { Title = "Chat", SourceType = "chat", NotesHtml = "<p>hi</p>" };

        Assert.Equal("Conversation", _inventory.Describe(share));
    }

    [Fact]
    public void Describe_SingularCounts()
    {
        var share = new ShareToken { Title = "One of each", FlashcardsJson = Items(1), QuizzesJson = Items(1), GlossaryJson = Items(1) };

        Assert.Equal("1 flashcard, 1 quiz question, 1 glossary term", _inventory.Describe(share));
    }

    [Fact]
    public void Describe_EmptyShareDescribesNothing()
    {
        Assert.Equal(string.Empty, _inventory.Describe(new ShareToken { Title = "Empty" }));
    }

    [Theory]
    [InlineData("not json at all")]
    [InlineData("{\"cards\":[1,2,3]}")]
    [InlineData("[]")]
    public void Describe_UncountableCollectionsAreSkippedRatherThanThrowing(string json)
    {
        var share = new ShareToken { Title = "Odd", Summary = "A summary", FlashcardsJson = json };

        Assert.Equal("Summary", _inventory.Describe(share));
    }

    private static string Items(int count) =>
        "[" + string.Join(",", Enumerable.Range(0, count).Select(i => $"{{\"i\":{i}}}")) + "]";
}
