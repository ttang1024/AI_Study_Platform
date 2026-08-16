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

public class GetLearningPathQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<IConceptLinkRepository> _links = new();
    private readonly GetLearningPathQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetLearningPathQueryHandlerTests()
    {
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.ConceptLinks).Returns(_links.Object);

        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<ConceptLink>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<LearningPathDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<LearningPathDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetLearningPathQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    private static GlossaryTerm MakeTerm(Guid userId, string name) => new()
    { GlossaryTermId = Guid.NewGuid(), UserId = userId, Term = name, Definition = "def" };

    [Fact]
    public async Task Handle_NoTerms_ReturnsEmptyPath()
    {
        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Steps);
        Assert.Equal(0, result.Data.TotalCount);
    }

    [Fact]
    public async Task Handle_DedupesTermsByNameCaseInsensitively()
    {
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(new[]
        {
            MakeTerm(_userId, "Mitosis"),
            MakeTerm(_userId, "mitosis"),
            MakeTerm(_userId, "MITOSIS"),
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.Equal(1, result.Data!.TotalCount);
    }

    [Fact]
    public async Task Handle_MasteredTermsAreStatusMastered()
    {
        var term = MakeTerm(_userId, "Mitosis");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(new[] { term });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { term.GlossaryTermId });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        var step = Assert.Single(result.Data!.Steps);
        Assert.Equal("mastered", step.Status);
        Assert.Equal(1, result.Data.MasteredCount);
    }

    [Fact]
    public async Task Handle_SingleUnmasteredTermWithNoPrereqs_IsNextAndFoundational()
    {
        var term = MakeTerm(_userId, "Mitosis");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(new[] { term });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        var step = Assert.Single(result.Data!.Steps);
        Assert.Equal("next", step.Status);
        Assert.Contains("Foundational", step.Reason);
    }

    [Fact]
    public async Task Handle_TermWithUnmasteredPrereq_IsBlocked()
    {
        var prereq = MakeTerm(_userId, "Cell");
        var dependent = MakeTerm(_userId, "Mitosis");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { prereq, dependent });
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new ConceptLink { SourceEntityType = "glossary", SourceEntityId = prereq.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = dependent.GlossaryTermId },
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        var dependentStep = result.Data!.Steps.Single(s => s.Concept == "Mitosis");
        Assert.Equal("blocked", dependentStep.Status);
        Assert.Contains("Cell", dependentStep.Reason);
        Assert.Contains("Cell", dependentStep.Prerequisites);
    }

    [Fact]
    public async Task Handle_PrereqMastered_UnblocksTheDependent()
    {
        var prereq = MakeTerm(_userId, "Cell");
        var dependent = MakeTerm(_userId, "Mitosis");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { prereq, dependent });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { prereq.GlossaryTermId });
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new ConceptLink { SourceEntityType = "glossary", SourceEntityId = prereq.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = dependent.GlossaryTermId },
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        var dependentStep = result.Data!.Steps.Single(s => s.Concept == "Mitosis");
        Assert.NotEqual("blocked", dependentStep.Status);
    }

    [Fact]
    public async Task Handle_NonGlossaryLinks_AreIgnored()
    {
        var a = MakeTerm(_userId, "A");
        var b = MakeTerm(_userId, "B");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { a, b });
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new ConceptLink { SourceEntityType = "document", SourceEntityId = a.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = b.GlossaryTermId },
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.DoesNotContain(result.Data!.Steps, s => s.Status == "blocked");
    }

    [Fact]
    public async Task Handle_SelfReferencingLink_IsIgnored()
    {
        var a = MakeTerm(_userId, "A");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { a });
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new ConceptLink { SourceEntityType = "glossary", SourceEntityId = a.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = a.GlossaryTermId },
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        // No exception, and the term is not blocked on itself.
        Assert.Equal("next", result.Data!.Steps.Single().Status);
    }

    [Fact]
    public async Task Handle_CyclicPrerequisites_DoesNotThrowAndAssignsDepth()
    {
        var a = MakeTerm(_userId, "A");
        var b = MakeTerm(_userId, "B");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { a, b });
        _links.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new ConceptLink { SourceEntityType = "glossary", SourceEntityId = a.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = b.GlossaryTermId },
            new ConceptLink { SourceEntityType = "glossary", SourceEntityId = b.GlossaryTermId, TargetEntityType = "glossary", TargetEntityId = a.GlossaryTermId },
        });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.Equal(2, result.Data!.Steps.Count);
    }

    [Fact]
    public async Task Handle_OnlyOneStepGetsNextStatus_RestAreReady()
    {
        var a = MakeTerm(_userId, "A");
        var b = MakeTerm(_userId, "B");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { a, b });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.Single(result.Data!.Steps, s => s.Status == "next");
        Assert.Single(result.Data.Steps, s => s.Status == "ready");
    }

    [Fact]
    public async Task Handle_UnmasteredTermsSortBeforeMasteredOnes()
    {
        var mastered = MakeTerm(_userId, "AlreadyKnown");
        var unmastered = MakeTerm(_userId, "ZNeedsLearning");
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { mastered, unmastered });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { mastered.GlossaryTermId });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        // "AlreadyKnown" would sort first alphabetically, but unmastered-first ordering wins.
        Assert.Equal("ZNeedsLearning", result.Data!.Steps.First().Concept);
    }

    [Fact]
    public async Task Handle_StepsAreSequentiallyNumberedFrom1()
    {
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { MakeTerm(_userId, "A"), MakeTerm(_userId, "B") });

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.Equal(new[] { 1, 2 }, result.Data!.Steps.Select(s => s.Order));
    }

    [Fact]
    public async Task Handle_CapsAt40Steps()
    {
        var terms = Enumerable.Range(0, 60).Select(i => MakeTerm(_userId, $"Term{i:D2}")).ToList();
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(terms);

        var result = await _handler.Handle(new GetLearningPathQuery(_userId), default);

        Assert.Equal(40, result.Data!.Steps.Count);
        Assert.Equal(60, result.Data.TotalCount);
    }
}
