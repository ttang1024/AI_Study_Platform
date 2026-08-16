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
/// Covers the branches not exercised by <see cref="KnowledgeGraphQueryTests"/>: glossary/note/quiz
/// concept edges, the concept-link node fallback path, and entity-type normalization.
/// </summary>
public class KnowledgeGraphQueryAdditionalTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IConceptLinkRepository> _links = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();

    private readonly GetKnowledgeGraphQueryHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();
    private readonly List<ConceptLink> _linkStore = new();
    private readonly List<DocumentGraphNode> _documentStore = new();
    private readonly List<VideoGraphNode> _videoStore = new();
    private readonly List<Note> _noteStore = new();
    private readonly List<Quiz> _quizStore = new();
    private readonly List<GlossaryTerm> _termStore = new();

    public KnowledgeGraphQueryAdditionalTests()
    {
        _uow.Setup(u => u.ConceptLinks).Returns(_links.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);

        _links.Setup(r => r.GetByUserAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _linkStore.ToList());
        _documents.Setup(r => r.GetGraphNodesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _documentStore.ToList());
        _videos.Setup(r => r.GetGraphNodesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _videoStore.ToList());
        _notes.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _noteStore.ToList());
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _quizStore.ToList());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _termStore.ToList());

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
    public async Task GlossaryTermCreatesConceptNodeLinkedToItsDocument()
    {
        var docId = AddDocument("bio.pdf");
        _termStore.Add(new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Term = "Mitosis", Definition = "Cell division" });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Type == "concept" && n.Title == "Mitosis");
        Assert.Contains(graph.Edges, e => e.Label == "defines");
        Assert.Equal(1, graph.Stats.Concepts);
    }

    [Fact]
    public async Task GlossaryTermLinkedToVideo()
    {
        var videoId = Guid.NewGuid();
        _videoStore.Add(new VideoGraphNode(videoId, _courseId, "Lecture", "abc123", false));
        _termStore.Add(new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, VideoId = videoId, Term = "Osmosis", Definition = "Water movement" });

        var graph = await Run();

        Assert.Contains(graph.Edges, e => e.Label == "defines" && (e.Source == $"video:{videoId}" || e.Target == $"video:{videoId}"));
    }

    [Fact]
    public async Task NoteMentioningKnownConceptCreatesMentionsEdge()
    {
        var docId = AddDocument("bio.pdf");
        _termStore.Add(new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Term = "Mitosis", Definition = "Cell division" });
        _noteStore.Add(new Note { NoteId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Title = "My note", Content = "Mitosis is important to understand." });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Type == "note");
        Assert.Contains(graph.Edges, e => e.Label == "mentions");
        Assert.Equal(1, graph.Stats.Notes);
    }

    [Fact]
    public async Task NoteWithNoTitleUsesTruncatedContentAsTitle()
    {
        var docId = AddDocument("a.pdf");
        var longContent = new string('x', 100);
        _noteStore.Add(new Note { NoteId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Title = null, Content = longContent });

        var node = Assert.Single((await Run()).Nodes, n => n.Type == "note");

        Assert.EndsWith("...", node.Title);
        Assert.True(node.Title.Length <= 67);
    }

    [Fact]
    public async Task NoteWithBlankTitleAndContent_IsUntitled()
    {
        var docId = AddDocument("a.pdf");
        _noteStore.Add(new Note { NoteId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Title = "  ", Content = "   " });

        var node = Assert.Single((await Run()).Nodes, n => n.Type == "note");

        Assert.Equal("Untitled note", node.Title);
    }

    [Fact]
    public async Task StandaloneNoteHasNoSourceEdge()
    {
        _noteStore.Add(new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "Free note", Content = "text" });

        var graph = await Run();

        Assert.Empty(graph.Edges);
    }

    [Fact]
    public async Task QuizzesForSameSourceAreGroupedIntoOneQuizNode()
    {
        var docId = AddDocument("bio.pdf");
        _quizStore.Add(new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Question = "Q1", OptionsJson = "[]", CorrectAnswer = "A", Explanation = "E1" });
        _quizStore.Add(new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Question = "Q2", OptionsJson = "[]", CorrectAnswer = "A", Explanation = "E2" });

        var graph = await Run();

        Assert.Single(graph.Nodes, n => n.Type == "quiz");
        Assert.Equal(1, graph.Stats.Quizzes);
        Assert.Contains(graph.Edges, e => e.Label == "has quiz");
    }

    [Fact]
    public async Task QuizWithNoSource_IsExcludedEntirely()
    {
        _quizStore.Add(new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, Question = "Q1", OptionsJson = "[]", CorrectAnswer = "A", Explanation = "E1" });

        var graph = await Run();

        Assert.DoesNotContain(graph.Nodes, n => n.Type == "quiz");
    }

    [Fact]
    public async Task QuizMentioningKnownConceptCreatesChecksEdge()
    {
        var docId = AddDocument("bio.pdf");
        _termStore.Add(new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Term = "Mitosis", Definition = "Cell division" });
        _quizStore.Add(new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Question = "What is Mitosis?", OptionsJson = "[]", CorrectAnswer = "A", Explanation = "It's cell division." });

        var graph = await Run();

        Assert.Contains(graph.Edges, e => e.Label == "checks");
    }

    [Fact]
    public async Task ConceptLink_TargetNotYetInGraph_FetchesDocumentToBuildNode()
    {
        var targetDocId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _documents.Setup(r => r.GetByIdAsync(targetDocId, default))
            .ReturnsAsync(new Document { DocumentId = targetDocId, UserId = _userId, FileName = "linked.pdf", ContentType = "application/pdf" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "document",
            TargetEntityId = targetDocId,
            LinkLabel = "expands on",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == "linked.pdf");
    }

    [Fact]
    public async Task ConceptLink_TargetDocumentDeleted_FallsBackToIdAsTitle()
    {
        var targetDocId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _documents.Setup(r => r.GetByIdAsync(targetDocId, default)).ReturnsAsync((Document?)null);
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "document",
            TargetEntityId = targetDocId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == targetDocId.ToString());
    }

    [Fact]
    public async Task ConceptLink_VideoTarget_FetchesVideoNode()
    {
        var videoId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _videos.Setup(r => r.GetByIdAsync(videoId, default))
            .ReturnsAsync(new Video { VideoId = videoId, UserId = _userId, Title = "Linked Video", ExternalVideoId = "ext" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "video",
            TargetEntityId = videoId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == "Linked Video" && n.Type == "video");
    }

    [Fact]
    public async Task ConceptLink_NoteTarget_FetchesNoteNode()
    {
        var noteId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _notes.Setup(r => r.GetByIdAsync(noteId, default))
            .ReturnsAsync(new Note { NoteId = noteId, UserId = _userId, Title = "Linked Note", Content = "x" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "note",
            TargetEntityId = noteId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == "Linked Note" && n.Type == "note");
    }

    [Fact]
    public async Task ConceptLink_GlossaryTarget_FetchesGlossaryNode()
    {
        var termId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _terms.Setup(r => r.GetByIdAsync(termId, default))
            .ReturnsAsync(new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Osmosis", Definition = "def" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "glossary",
            TargetEntityId = termId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == "Osmosis" && n.Type == "concept");
    }

    [Fact]
    public async Task ConceptLink_FlashcardTarget_FetchesFlashcardNode()
    {
        var cardId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _flashcards.Setup(r => r.GetByIdAsync(cardId, default))
            .ReturnsAsync(new Flashcard { FlashcardId = cardId, UserId = _userId, Front = "What is X?", Back = "Y" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "flashcard",
            TargetEntityId = cardId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Title == "What is X?" && n.Type == "flashcard");
    }

    [Fact]
    public async Task ConceptLink_UnrecognisedEntityType_UsesDefaultFallbackNode()
    {
        var externalId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "external",
            TargetEntityId = externalId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Type == "external" && n.Title == externalId.ToString());
    }

    [Theory]
    [InlineData("youtube")]
    [InlineData("youtubeVideo")]
    [InlineData("YOUTUBE")]
    public async Task ConceptLink_YoutubeEntityType_NormalizedToVideo(string entityType)
    {
        var videoId = Guid.NewGuid();
        var sourceDocId = AddDocument("a.pdf");
        _videos.Setup(r => r.GetByIdAsync(videoId, default))
            .ReturnsAsync(new Video { VideoId = videoId, UserId = _userId, Title = "V", ExternalVideoId = "ext" });
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = entityType,
            TargetEntityId = videoId,
            LinkLabel = "relates",
        });

        var graph = await Run();

        Assert.Contains(graph.Nodes, n => n.Id == $"video:{videoId}");
    }

    [Fact]
    public async Task ConceptLink_NullLabel_DefaultsToRelated()
    {
        var sourceDocId = AddDocument("a.pdf");
        var targetDocId = AddDocument("b.pdf");
        _linkStore.Add(new ConceptLink
        {
            ConceptLinkId = Guid.NewGuid(),
            UserId = _userId,
            SourceEntityType = "document",
            SourceEntityId = sourceDocId,
            TargetEntityType = "document",
            TargetEntityId = targetDocId,
            LinkLabel = null,
        });

        var graph = await Run();

        Assert.Contains(graph.Edges, e => e.Label == "related");
    }
}
