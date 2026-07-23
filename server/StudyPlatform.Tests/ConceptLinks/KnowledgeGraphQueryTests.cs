using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.ConceptLinks;

/// <summary>
/// The knowledge graph builds its nodes from projected material rows (labels only — never the transcript
/// or summary text) and then chains each course's materials together. These tests pin the node
/// classification and the "don't chain what is already connected" rule that chaining depends on.
/// </summary>
public class KnowledgeGraphQueryTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IConceptLinkRepository> _links = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();

    private readonly GetKnowledgeGraphQueryHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();
    private readonly List<ConceptLink> _linkStore = new();
    private readonly List<DocumentGraphNode> _documentStore = new();
    private readonly List<VideoGraphNode> _videoStore = new();

    public KnowledgeGraphQueryTests()
    {
        _uow.Setup(u => u.ConceptLinks).Returns(_links.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);

        _links.Setup(r => r.GetByUserAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _linkStore.ToList());
        _documents.Setup(r => r.GetGraphNodesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _documentStore.ToList());
        _videos.Setup(r => r.GetGraphNodesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _videoStore.ToList());
        _notes.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Note>());
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Quiz>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<GlossaryTerm>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<KnowledgeGraphDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<KnowledgeGraphDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetKnowledgeGraphQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    private Guid AddDocument(string fileName, string contentType = "application/pdf", string? originalUrl = null, bool hasArtifacts = false)
    {
        var id = Guid.NewGuid();
        _documentStore.Add(new DocumentGraphNode(id, _courseId, fileName, contentType, originalUrl, hasArtifacts));
        return id;
    }

    private async Task<KnowledgeGraphDto> Run()
    {
        var result = await _handler.Handle(new GetKnowledgeGraphQuery(_userId), default);
        Assert.True(result.IsSuccess);
        return result.Data!;
    }

    [Fact]
    public async Task MaterialsInACourseAreChainedTogether()
    {
        AddDocument("a.pdf");
        AddDocument("b.pdf");
        AddDocument("c.pdf");

        var graph = await Run();

        // Three materials chain into two links, not a full mesh.
        Assert.Equal(2, graph.Edges.Count(e => e.Label == "same course"));
        Assert.Equal(3, graph.Stats.Materials);
    }

    // The chaining step asks "are these already connected?" before adding its edge. An explicit concept
    // link between two neighbours therefore stands on its own — it must not be shadowed by a second,
    // weaker "same course" edge between the same pair.
    [Fact]
    public async Task AlreadyConnectedMaterialsAreNotChainedAgain()
    {
        var first = AddDocument("a.pdf");
        var second = AddDocument("b.pdf");
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = first,
            TargetEntityType = "document",
            TargetEntityId = second,
            LinkLabel = "expands on",
        });

        var graph = await Run();

        Assert.DoesNotContain(graph.Edges, e => e.Label == "same course");
        var edge = Assert.Single(graph.Edges);
        Assert.Equal("expands on", edge.Label);
    }

    // Direction is irrelevant: the pair is normalised before it is looked up.
    [Fact]
    public async Task ConnectionCheckIgnoresEdgeDirection()
    {
        var first = AddDocument("a.pdf");
        var second = AddDocument("b.pdf");
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = second,   // reversed relative to the sort order used for chaining
            TargetEntityType = "document",
            TargetEntityId = first,
            LinkLabel = "relates to",
        });

        var graph = await Run();

        Assert.Single(graph.Edges);
    }

    [Fact]
    public async Task MaterialsInDifferentCoursesAreNotChained()
    {
        AddDocument("a.pdf");
        _documentStore.Add(new DocumentGraphNode(Guid.NewGuid(), Guid.NewGuid(), "b.pdf", "application/pdf", null, false));

        var graph = await Run();

        Assert.Empty(graph.Edges);
    }

    [Theory]
    [InlineData("application/pdf", null, "notes.pdf", "document", "/documents/")]
    [InlineData("text/html", "https://example.com/post", "post.html", "article", "/articles/")]
    [InlineData("audio/mpeg", null, "lecture.mp3", "audio", "/audio/")]
    [InlineData("audio/podcast", null, "ep1", "podcast", "/audio/")]
    [InlineData("application/octet-stream", null, "lecture.m4a", "audio", "/audio/")]
    public async Task DocumentKindComesFromContentTypeAndUrl(
        string contentType, string? originalUrl, string fileName, string expectedType, string expectedUrlPrefix)
    {
        var id = AddDocument(fileName, contentType, originalUrl);

        var node = Assert.Single((await Run()).Nodes);

        Assert.Equal(expectedType, node.Type);
        Assert.Equal($"{expectedUrlPrefix}{id}", node.Url);
    }

    [Fact]
    public async Task MaterialsWithGeneratedArtifactsWeighMore()
    {
        AddDocument("plain.pdf");
        AddDocument("studied.pdf", hasArtifacts: true);

        var nodes = (await Run()).Nodes.ToDictionary(n => n.Title, n => n.Weight);

        Assert.Equal(1, nodes["plain.pdf"]);
        Assert.Equal(3, nodes["studied.pdf"]);
    }

    [Fact]
    public async Task VideoNodesFallBackToTheExternalIdWhenUntitled()
    {
        _videoStore.Add(new VideoGraphNode(Guid.NewGuid(), _courseId, "   ", "dQw4w9WgXcQ", false));

        var node = Assert.Single((await Run()).Nodes);

        Assert.Equal("video", node.Type);
        Assert.Equal("dQw4w9WgXcQ", node.Title);
    }
}
