using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class DocumentContentServiceTests
{
    private readonly Mock<IBlobStorageService> _blob = new();
    private readonly Mock<IDocumentTextExtractor> _extractor = new();
    private readonly DocumentContentService _service;

    public DocumentContentServiceTests()
    {
        _service = new DocumentContentService(_blob.Object, _extractor.Object);
    }

    private static Document MakeDoc(string contentType, string blobUrl = "blob://test", string? transcript = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        ContentType = contentType,
        BlobUrl = blobUrl,
        Transcript = transcript
    };

    // ─── PDF / inline-binary ──────────────────────────────────────────────────

    [Fact]
    public async Task GetContentAsync_PdfDocument_ReturnsBytes()
    {
        var doc = MakeDoc("application/pdf");
        var bytes = new byte[] { 1, 2, 3 };

        _blob.Setup(b => b.DownloadAsync("blob://test", default))
             .ReturnsAsync(new MemoryStream(bytes));

        var result = await _service.GetContentAsync(doc);

        Assert.Equal(bytes, result.Bytes);
        Assert.Null(result.Text);
    }

    [Fact]
    public async Task GetContentAsync_ImageDocument_ReturnsBytes()
    {
        var doc = MakeDoc("image/png");
        var bytes = new byte[] { 10, 20 };
        _blob.Setup(b => b.DownloadAsync("blob://test", default))
             .ReturnsAsync(new MemoryStream(bytes));

        var result = await _service.GetContentAsync(doc);

        Assert.Equal(bytes, result.Bytes);
    }

    // ─── Text-based documents ─────────────────────────────────────────────────

    [Fact]
    public async Task GetContentAsync_TextDocument_ReturnsExtractedText()
    {
        var doc = MakeDoc("text/plain");
        _extractor.Setup(e => e.ExtractTextAsync("blob://test", "text/plain", default)).ReturnsAsync("extracted text");

        var result = await _service.GetContentAsync(doc);

        Assert.Null(result.Bytes);
        Assert.Equal("extracted text", result.Text);
    }

    [Fact]
    public async Task GetContentAsync_DocxDocument_UsesTextExtractor()
    {
        var doc = MakeDoc("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        _extractor.Setup(e => e.ExtractTextAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync("docx content");

        var result = await _service.GetContentAsync(doc);

        Assert.Equal("docx content", result.Text);
        _blob.Verify(b => b.DownloadAsync(It.IsAny<string>(), default), Times.Never);
    }

    // ─── Audio documents ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetContentAsync_AudioWithTranscript_ReturnsTranscriptText()
    {
        var doc = MakeDoc("audio/mpeg", transcript: "Hello world");

        var result = await _service.GetContentAsync(doc);

        Assert.Null(result.Bytes);
        Assert.Equal("Hello world", result.Text);
        _blob.Verify(b => b.DownloadAsync(It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task GetContentAsync_AudioNoTranscript_SupportedType_ReturnsBytes()
    {
        var doc = MakeDoc("audio/mpeg");
        var bytes = new byte[] { 5, 6, 7 };
        _blob.Setup(b => b.DownloadAsync("blob://test", default))
             .ReturnsAsync(new MemoryStream(bytes));

        var result = await _service.GetContentAsync(doc);

        Assert.Equal(bytes, result.Bytes);
        Assert.Null(result.Text);
    }

    [Fact]
    public async Task GetContentAsync_AudioNoTranscript_UnsupportedType_ReturnsEmptyText()
    {
        // A custom audio type not in AiInlineData.IsSupported
        var doc = MakeDoc("audio/x-custom-unsupported");

        var result = await _service.GetContentAsync(doc);

        Assert.Null(result.Bytes);
        Assert.Equal(string.Empty, result.Text);
        _blob.Verify(b => b.DownloadAsync(It.IsAny<string>(), default), Times.Never);
    }
}
