using Moq;
using StudyPlatform.Application.Documents;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class DocumentAiStreamsTests
{
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly DocumentAiStreams _streams;
    private readonly Guid _userId = Guid.NewGuid();

    public DocumentAiStreamsTests()
    {
        _streams = new DocumentAiStreams(_documents.Object, _ai.Object, _content.Object);
    }

    [Fact]
    public async Task SomeoneElsesDocument_IsNotFound()
    {
        var result = await _streams.StreamSummaryAsync(Guid.NewGuid(), _userId, default);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task AudioTranscript_GetsATimelineSummary()
    {
        var document = new Document { DocumentId = Guid.NewGuid(), UserId = _userId, ContentType = "audio/mpeg" };
        _documents.Setup(r => r.GetByIdAsync(document.DocumentId, It.IsAny<CancellationToken>())).ReturnsAsync(document);
        _content.Setup(c => c.GetContentAsync(document, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocumentContent(null, """[{"start":0,"end":5,"text":"Hello"},{"start":65,"text":"Later"}]"""));

        var result = await _streams.StreamSummaryAsync(document.DocumentId, _userId, default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.StreamTimelineSummaryAsync(
            It.Is<string>(t => t.Contains("Hello") && t.Contains("Later") && t.Contains("01:05")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task FinishedSummary_WritesOnlyTheSummaryColumn()
    {
        var document = new Document { DocumentId = Guid.NewGuid(), UserId = _userId, ContentType = "text/plain" };
        _documents.Setup(r => r.GetByIdAsync(document.DocumentId, It.IsAny<CancellationToken>())).ReturnsAsync(document);
        _content.Setup(c => c.GetContentAsync(document, It.IsAny<CancellationToken>())).ReturnsAsync(new DocumentContent(null, "text"));

        var result = await _streams.StreamSummaryAsync(document.DocumentId, _userId, default);
        await result.Data!.OnCompleted!("the summary", default);

        // Saving the whole entity loaded at stream start overwrote a mind map finished in the meantime.
        _documents.Verify(r => r.SaveSummaryAsync(document.DocumentId, "the summary", It.IsAny<CancellationToken>()), Times.Once);
        _documents.Verify(r => r.Update(It.IsAny<Document>()), Times.Never);
    }
}
