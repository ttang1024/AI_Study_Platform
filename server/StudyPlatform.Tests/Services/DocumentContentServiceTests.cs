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

    // ─── Oversized files ──────────────────────────────────────────────────────

    // A 40 MB PDF used to be downloaded, base64'd (UTF-16, so ~107 MB of string) and serialised
    // into the request body, which threw OutOfMemoryException on a 2 GB task. Anything over the
    // inline ceiling goes to the text extractor instead.
    [Fact]
    public async Task GetContentAsync_PdfOverInlineLimit_FallsBackToTextExtraction()
    {
        var doc = MakeDoc("application/pdf");
        doc.FileSize = 40L * 1024 * 1024;
        _extractor.Setup(e => e.ExtractTextAsync("blob://test", "application/pdf", default))
                  .ReturnsAsync("extracted");

        var result = await _service.GetContentAsync(doc);

        Assert.Null(result.Bytes);
        Assert.Equal("extracted", result.Text);
        _blob.Verify(b => b.DownloadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetContentAsync_PdfUnderInlineLimit_StillSendsBytes()
    {
        var doc = MakeDoc("application/pdf");
        doc.FileSize = 3;
        var bytes = new byte[] { 1, 2, 3 };
        _blob.Setup(b => b.DownloadAsync("blob://test", default)).ReturnsAsync(new MemoryStream(bytes));

        var result = await _service.GetContentAsync(doc);

        Assert.Equal(bytes, result.Bytes);
    }

    // Audio has no text fallback, so an oversized file must raise rather than hand the model an
    // empty string and pass off whatever it invents as a summary.
    [Fact]
    public async Task GetContentAsync_AudioOverInlineLimit_WithoutTranscript_Throws()
    {
        var doc = MakeDoc("audio/mpeg");
        doc.FileSize = 40L * 1024 * 1024;

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _service.GetContentAsync(doc));
        Assert.Contains("40 MB", ex.Message);
    }

    [Fact]
    public async Task GetContentAsync_AudioOverInlineLimit_WithTranscript_UsesTranscript()
    {
        var doc = MakeDoc("audio/mpeg", transcript: "spoken words");
        doc.FileSize = 40L * 1024 * 1024;

        var result = await _service.GetContentAsync(doc);

        Assert.Equal("spoken words", result.Text);
    }

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
