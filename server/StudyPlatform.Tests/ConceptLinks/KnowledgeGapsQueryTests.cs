using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.ConceptLinks;

public class GetKnowledgeGapsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetKnowledgeGapsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetKnowledgeGapsQueryHandlerTests()
    {
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);

        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Note>());
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<KnowledgeGapsDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<KnowledgeGapsDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetKnowledgeGapsQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_NoTerms_ReturnsEmptyGapsAndZeroStats()
    {
        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Gaps);
        Assert.Equal(0, result.Data.Stats.TotalConcepts);
    }

    [Fact]
    public async Task Handle_MasteredTermWithNoReferencesOrCrossCourse_ProducesNoGap()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = Guid.NewGuid() } });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.Empty(result.Data!.Gaps);
        Assert.Equal(1, result.Data.Stats.TotalConcepts);
    }

    [Fact]
    public async Task Handle_HeavilyReferencedUnmasteredTerm_IsHighSeverity()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = Guid.NewGuid() } });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N1", Content = "Mitosis happens in cells." },
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N2", Content = "Mitosis is cell division." },
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N3", Content = "Mitosis review notes." },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        var gap = Assert.Single(result.Data!.Gaps);
        Assert.Equal("high", gap.Severity);
        Assert.Equal(3, gap.ReferenceCount);
    }

    [Fact]
    public async Task Handle_LightlyReferencedUnmasteredTerm_IsMediumSeverity()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = Guid.NewGuid() } });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N1", Content = "Mitosis happens in cells." },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.Equal("medium", result.Data!.Gaps.Single().Severity);
    }

    [Fact]
    public async Task Handle_UndefinedTermReferencedInNotes_IsMediumSeverityAndMarkedUndefined()
    {
        var termId = Guid.NewGuid();
        // A term with no DocumentId/VideoId is "undefined" (no glossary source material).
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Osmosis", Definition = "def" } });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N1", Content = "Osmosis moves water." },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        var gap = Assert.Single(result.Data!.Gaps);
        Assert.Equal("medium", gap.Severity);
        Assert.False(gap.Defined);
        Assert.Equal(1, result.Data.Stats.Undefined);
    }

    [Fact]
    public async Task Handle_CrossCourseUnmasteredTerm_IsHighSeverity()
    {
        var termId = Guid.NewGuid();
        var docA = Guid.NewGuid();
        var docB = Guid.NewGuid();
        var courseA = Guid.NewGuid();
        var courseB = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = docA, UserId = _userId, CourseId = courseA },
            new Document { DocumentId = docB, UserId = _userId, CourseId = courseB },
        });
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = docA } });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N1", Content = "Mitosis!", DocumentId = docB },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        var gap = Assert.Single(result.Data!.Gaps);
        Assert.Equal("high", gap.Severity);
        Assert.Equal(2, gap.CourseIds.Count());
        Assert.Equal(1, result.Data.Stats.CrossCourse);
    }

    [Fact]
    public async Task Handle_CrossCourseMasteredTermWithNoOtherSignal_IsLowSeverity()
    {
        var termId = Guid.NewGuid();
        var docA = Guid.NewGuid();
        var docB = Guid.NewGuid();
        var courseA = Guid.NewGuid();
        var courseB = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = docA, UserId = _userId, CourseId = courseA },
            new Document { DocumentId = docB, UserId = _userId, CourseId = courseB },
        });
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = docA } });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "N1", Content = "Mitosis!", DocumentId = docB },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.Equal("low", result.Data!.Gaps.Single().Severity);
    }

    [Fact]
    public async Task Handle_QuizzesAlsoCountAsReferences()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = Guid.NewGuid() } });
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, Question = "What is Mitosis?", Explanation = "" },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.Equal(1, result.Data!.Gaps.Single().ReferenceCount);
    }

    [Fact]
    public async Task Handle_ResultsOrderedBySeverityThenReferenceCount()
    {
        var lowDocId = Guid.NewGuid();
        var lowId = Guid.NewGuid();
        var highId = Guid.NewGuid();
        // "Anatomy" is mastered and only cross-course (no other signal) -> low severity.
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = lowId, UserId = _userId, Term = "Anatomy", Definition = "def", DocumentId = lowDocId },
            new GlossaryTerm { GlossaryTermId = highId, UserId = _userId, Term = "Mitosis", Definition = "def", DocumentId = Guid.NewGuid() },
        });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { lowId });
        var otherDocId = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = lowDocId, UserId = _userId, CourseId = Guid.NewGuid() },
            new Document { DocumentId = otherDocId, UserId = _userId, CourseId = Guid.NewGuid() },
        });
        // Referenced from a document in a different course than its own -> cross-course.
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "", Content = "Anatomy overview.", DocumentId = otherDocId },
            // Mitosis referenced in 3 separate notes -> unmastered + 3 references -> high severity.
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "", Content = "Mitosis divides." },
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "", Content = "Mitosis review." },
            new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "", Content = "Mitosis test." },
        });

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        var gaps = result.Data!.Gaps.ToList();
        Assert.Equal("Mitosis", gaps[0].Concept);
        Assert.Equal("high", gaps[0].Severity);
        Assert.Equal("Anatomy", gaps[1].Concept);
        Assert.Equal("low", gaps[1].Severity);
    }

    [Fact]
    public async Task Handle_CapsResultsAt60()
    {
        var terms = Enumerable.Range(0, 80)
            .Select(i => new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = $"Term{i}" })
            .ToList();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(terms);
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(
            terms.Select(t => new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "", Content = t.Term }).ToArray());

        var result = await _handler.Handle(new GetKnowledgeGapsQuery(_userId), default);

        Assert.Equal(60, result.Data!.Gaps.Count());
    }
}
