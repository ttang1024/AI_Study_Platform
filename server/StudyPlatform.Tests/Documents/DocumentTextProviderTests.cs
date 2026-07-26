using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Documents;

/// <summary>
/// The invariant under test: a document's text is extracted at most once and every later caller
/// gets that identical string. Citation offsets index into it, so a second extraction — the PDF and
/// image paths fall back to non-deterministic AI transcription — would silently move every anchor.
/// </summary>
public class DocumentTextProviderTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IDocumentTextExtractor> _extractor = new();
    private readonly DocumentTextProvider _provider;

    public DocumentTextProviderTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _provider = new DocumentTextProvider(
            _uow.Object, () => _extractor.Object, NullLogger<DocumentTextProvider>.Instance);
    }

    private static Document Doc(string contentType = "application/pdf", string? extracted = null, string? transcript = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        ContentType = contentType,
        BlobUrl = "blob://doc.pdf",
        ExtractedText = extracted,
        Transcript = transcript,
    };

    [Fact]
    public async Task FirstCall_ExtractsAndPersists()
    {
        var document = Doc();
        _extractor.Setup(e => e.ExtractTextAsync(document.BlobUrl, document.ContentType, default))
            .ReturnsAsync("the extracted body text");

        var text = await _provider.GetTextAsync(document);

        Assert.Equal("the extracted body text", text);
        Assert.Equal("the extracted body text", document.ExtractedText);
        _documents.Verify(r => r.Update(document), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task SecondCall_ReturnsTheStoredCopyWithoutReExtracting()
    {
        // The heart of it: re-extraction would produce a different string for OCR'd sources, and
        // every offset stored against the first one would then be wrong.
        var document = Doc(extracted: "the original extracted text");

        var text = await _provider.GetTextAsync(document);

        Assert.Equal("the original extracted text", text);
        _extractor.Verify(
            e => e.ExtractTextAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task PdfIsExtracted_SoItIsCitable()
    {
        // PDFs reach the model as raw bytes, so before this provider existed they had no text to
        // anchor a citation against at all.
        var document = Doc("application/pdf");
        _extractor.Setup(e => e.ExtractTextAsync(document.BlobUrl, "application/pdf", default))
            .ReturnsAsync("pdf body");

        Assert.Equal("pdf body", await _provider.GetTextAsync(document));
    }

    [Fact]
    public async Task Image_IsNotExtracted()
    {
        // Extracting an image means a paid AI OCR call. Enabling a citation link is not a good
        // enough reason to spend the user's tokens without them asking.
        var document = Doc("image/png");

        Assert.Null(await _provider.GetTextAsync(document));
        _extractor.Verify(
            e => e.ExtractTextAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Audio_UsesItsTranscript()
    {
        var document = Doc("audio/mpeg", transcript: "spoken words");

        Assert.Equal("spoken words", await _provider.GetTextAsync(document));
        _extractor.Verify(
            e => e.ExtractTextAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task AudioWithoutTranscript_IsNull()
    {
        Assert.Null(await _provider.GetTextAsync(Doc("audio/mpeg")));
    }

    [Fact]
    public async Task EmptyExtraction_IsNotPersisted()
    {
        // Persisting "" would make every later call believe the text is known and skip extraction
        // forever, even after the document is replaced with one that does have a text layer.
        var document = Doc();
        _extractor.Setup(e => e.ExtractTextAsync(document.BlobUrl, document.ContentType, default))
            .ReturnsAsync("   ");

        Assert.Null(await _provider.GetTextAsync(document));
        Assert.Null(document.ExtractedText);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task ExtractionFailure_DegradesToNullRatherThanThrowing()
    {
        // A document whose text cannot be extracted must still summarize, quiz and generate cards.
        var document = Doc();
        _extractor.Setup(e => e.ExtractTextAsync(document.BlobUrl, document.ContentType, default))
            .ThrowsAsync(new InvalidOperationException("extractor exploded"));

        Assert.Null(await _provider.GetTextAsync(document));
    }

    [Fact]
    public async Task AnchorOffsetsLandOnTheSameSpanTheViewWouldRender()
    {
        // End-to-end on the contract that matters: resolve a quote against the provider's text, then
        // slice the provider's text with the resulting offsets and get the quote back.
        var body = "Chapter 2. Photosynthesis converts light energy into chemical energy stored in glucose. "
                   + "It occurs in the chloroplasts of plant cells.";
        var document = Doc();
        _extractor.Setup(e => e.ExtractTextAsync(document.BlobUrl, document.ContentType, default))
            .ReturnsAsync(body);

        var text = await _provider.GetTextAsync(document);
        var anchor = StudyPlatform.Application.Common.SourceAnchorResolver.Resolve(
            text, "converts light energy into chemical energy stored in glucose");

        Assert.NotNull(anchor);
        Assert.True(anchor!.IsLocated);

        // The source view slices the identical string it received from this provider.
        var rendered = text![anchor.StartOffset!.Value..anchor.EndOffset!.Value];
        Assert.Contains("converts light energy into chemical energy", rendered);
    }
}
