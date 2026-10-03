using Moq;
using StudyPlatform.Application.Chat;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Chat;

public class ChatTurnRecorderTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IChatMessageRepository> _chat = new();
    private readonly ChatTurnRecorder _recorder;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<ChatMessage> _added = [];
    private readonly List<ChatConversation> _updatedConversations = [];

    private readonly ChatConversation _conversation = new()
    {
        ConversationId = Guid.NewGuid(),
        Title = "New conversation",
        UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
    };

    public ChatTurnRecorderTests()
    {
        _uow.Setup(u => u.ChatMessages).Returns(_chat.Object);
        _chat.Setup(r => r.AddAsync(It.IsAny<ChatMessage>(), default))
            .Callback<ChatMessage, CancellationToken>((m, _) => _added.Add(m))
            .Returns(Task.CompletedTask);
        _chat.Setup(r => r.UpdateConversation(It.IsAny<ChatConversation>()))
            .Callback<ChatConversation>(_updatedConversations.Add);
        _recorder = new ChatTurnRecorder(_uow.Object);
    }

    private ChatThread DocumentThread(Guid documentId) =>
        new(_userId, _conversation, "document", DocumentId: documentId);

    private ChatThread VideoThread(Guid videoId) =>
        new(_userId, _conversation, "video", VideoId: videoId);

    [Fact]
    public async Task RecordUserAsync_WritesTheUserTurnIntoTheThread()
    {
        var documentId = Guid.NewGuid();

        await _recorder.RecordUserAsync(DocumentThread(documentId), "What is entropy?");

        var message = Assert.Single(_added);
        Assert.Equal("user", message.Role);
        Assert.Equal("What is entropy?", message.Content);
        Assert.Equal(_conversation.ConversationId, message.ChatConversationId);
        Assert.Equal(documentId, message.DocumentId);
        Assert.Null(message.VideoId);
        Assert.Equal("document", message.SourceType);
        Assert.Equal(_userId, message.UserId);
    }

    [Fact]
    public async Task RecordAssistantAsync_WritesTheAssistantTurnWithNoAttachments()
    {
        await _recorder.RecordAssistantAsync(DocumentThread(Guid.NewGuid()), "Entropy is…");

        var message = Assert.Single(_added);
        Assert.Equal("assistant", message.Role);
        Assert.Equal("Entropy is…", message.Content);
        Assert.Null(message.AttachmentsJson);
    }

    [Fact]
    public async Task RecordUserAsync_OnAVideoThread_HangsTheRowOffTheVideo()
    {
        var videoId = Guid.NewGuid();

        await _recorder.RecordUserAsync(VideoThread(videoId), "Summarise this");

        var message = Assert.Single(_added);
        Assert.Equal(videoId, message.VideoId);
        Assert.Null(message.DocumentId);
        Assert.Equal("video", message.SourceType);
    }

    [Fact]
    public async Task RecordUserAsync_OnAGeneralThread_HangsTheRowOffNeither()
    {
        await _recorder.RecordUserAsync(new ChatThread(_userId, _conversation, "general"), "Hello");

        var message = Assert.Single(_added);
        Assert.Null(message.DocumentId);
        Assert.Null(message.VideoId);
        Assert.Equal("general", message.SourceType);
    }

    [Fact]
    public async Task RecordUserAsync_CarriesTheStoredAttachmentReferences()
    {
        await _recorder.RecordUserAsync(
            DocumentThread(Guid.NewGuid()), "Look at this", attachmentsJson: "[{\"blobUrl\":\"x\"}]");

        Assert.Equal("[{\"blobUrl\":\"x\"}]", Assert.Single(_added).AttachmentsJson);
    }

    [Fact]
    public async Task RecordUserAsync_WithATitle_RenamesTheThread()
    {
        await _recorder.RecordUserAsync(
            DocumentThread(Guid.NewGuid()), "What is entropy?", title: "What is entropy?");

        Assert.Equal("What is entropy?", _conversation.Title);
        Assert.Same(_conversation, Assert.Single(_updatedConversations));
    }

    [Fact]
    public async Task RecordUserAsync_WithoutATitle_LeavesTheThreadName()
    {
        await _recorder.RecordUserAsync(DocumentThread(Guid.NewGuid()), "A follow-up question");

        Assert.Equal("New conversation", _conversation.Title);
    }

    [Fact]
    public async Task RecordAsync_BumpsTheThreadsUpdatedAtSoItSortsToTheTop()
    {
        await _recorder.RecordAssistantAsync(DocumentThread(Guid.NewGuid()), "An answer");

        Assert.True(_conversation.UpdatedAt > new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        Assert.Single(_updatedConversations);
    }

    [Fact]
    public async Task RecordAsync_SavesEachHalfOfTheTurnIndependently()
    {
        var thread = DocumentThread(Guid.NewGuid());

        await _recorder.RecordUserAsync(thread, "Question");
        await _recorder.RecordAssistantAsync(thread, "Answer");

        // The user turn is saved before the model is called, the assistant turn after it streams,
        // so an abandoned stream still leaves the question in the history.
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Exactly(2));
        Assert.Equal(["user", "assistant"], _added.Select(m => m.Role));
    }
}
