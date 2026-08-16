using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class ChatAttachmentStoreTests
{
    private readonly Mock<IBlobStorageService> _blob = new();

    [Fact]
    public async Task SaveAsync_NoAttachments_ReturnsNull()
    {
        var result = await ChatAttachmentStore.SaveAsync(
            _blob.Object, Array.Empty<(byte[], string, string?)>(), Guid.NewGuid(), default);

        Assert.Null(result);
        _blob.Verify(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task SaveAsync_UploadsEachAttachmentAndReturnsJson()
    {
        _blob.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("blob://uploaded");
        var attachments = new (byte[] data, string mimeType, string? fileName)[]
        {
            (new byte[] { 1, 2 }, "image/png", "screenshot.png"),
            (new byte[] { 3, 4 }, "application/pdf", "doc.pdf"),
        };

        var json = await ChatAttachmentStore.SaveAsync(_blob.Object, attachments, Guid.NewGuid(), default);

        Assert.NotNull(json);
        Assert.Contains("blob://uploaded", json);
        _blob.Verify(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Exactly(2));
    }

    [Fact]
    public async Task SaveAsync_UsesCorrectExtensionForKnownMimeTypes()
    {
        string? capturedKey = null;
        _blob.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<Stream, string, string, CancellationToken>((_, key, _, _) => capturedKey = key)
            .ReturnsAsync("blob://x");

        await ChatAttachmentStore.SaveAsync(
            _blob.Object, new (byte[], string, string?)[] { (new byte[] { 1 }, "image/webp", null) }, Guid.NewGuid(), default);

        Assert.EndsWith(".webp", capturedKey);
    }

    [Fact]
    public async Task SaveAsync_UnknownMimeType_UsesBinExtension()
    {
        string? capturedKey = null;
        _blob.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<Stream, string, string, CancellationToken>((_, key, _, _) => capturedKey = key)
            .ReturnsAsync("blob://x");

        await ChatAttachmentStore.SaveAsync(
            _blob.Object, new (byte[], string, string?)[] { (new byte[] { 1 }, "application/zip", null) }, Guid.NewGuid(), default);

        Assert.EndsWith(".bin", capturedKey);
    }

    [Fact]
    public async Task LoadAsync_NullOrWhitespaceJson_ReturnsEmpty()
    {
        Assert.Empty(await ChatAttachmentStore.LoadAsync(_blob.Object, null, default));
        Assert.Empty(await ChatAttachmentStore.LoadAsync(_blob.Object, "  ", default));
    }

    [Fact]
    public async Task LoadAsync_MalformedJson_ReturnsEmpty()
    {
        var result = await ChatAttachmentStore.LoadAsync(_blob.Object, "{not valid", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task LoadAsync_ValidJson_ReturnsPresignedUrls()
    {
        var json = """[{"BlobUrl":"blob://x","MimeType":"image/png","FileName":"a.png"}]""";
        _blob.Setup(b => b.GetSasUrlAsync("blob://x", 1440, default)).ReturnsAsync("https://sas/a.png");

        var result = await ChatAttachmentStore.LoadAsync(_blob.Object, json, default);

        var attachment = Assert.Single(result);
        Assert.Equal("https://sas/a.png", attachment.Url);
        Assert.Equal("image/png", attachment.MimeType);
        Assert.Equal("a.png", attachment.FileName);
    }

    [Fact]
    public async Task LoadAsync_SasUrlThrows_SkipsThatAttachment()
    {
        var json = """
            [
            {"BlobUrl":"blob://good","MimeType":"image/png","FileName":"a.png"},
            {"BlobUrl":"blob://bad","MimeType":"image/png","FileName":"b.png"}
            ]
            """;
        _blob.Setup(b => b.GetSasUrlAsync("blob://good", 1440, default)).ReturnsAsync("https://sas/a.png");
        _blob.Setup(b => b.GetSasUrlAsync("blob://bad", 1440, default)).ThrowsAsync(new InvalidOperationException("boom"));

        var result = await ChatAttachmentStore.LoadAsync(_blob.Object, json, default);

        var attachment = Assert.Single(result);
        Assert.Equal("a.png", attachment.FileName);
    }

    [Fact]
    public async Task ToDtoAsync_NoAttachments_ReturnsNullAttachmentsList()
    {
        var message = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            Role = "user",
            Content = "hi",
            CreatedAt = DateTime.UtcNow,
            AttachmentsJson = null,
        };

        var dto = await message.ToDtoAsync(_blob.Object, default);

        Assert.Null(dto.Attachments);
        Assert.Equal("hi", dto.Content);
    }

    [Fact]
    public async Task ToDtoAsync_WithAttachments_PopulatesAttachmentsList()
    {
        var message = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            Role = "assistant",
            Content = "here",
            CreatedAt = DateTime.UtcNow,
            AttachmentsJson = """[{"BlobUrl":"blob://x","MimeType":"image/png","FileName":"a.png"}]""",
        };
        _blob.Setup(b => b.GetSasUrlAsync("blob://x", 1440, default)).ReturnsAsync("https://sas/a.png");

        var dto = await message.ToDtoAsync(_blob.Object, default);

        Assert.NotNull(dto.Attachments);
        Assert.Single(dto.Attachments!);
    }
}
