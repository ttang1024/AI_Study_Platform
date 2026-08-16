using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Planner;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Planner;

public class GetCramSheetQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly GetCramSheetQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();

    public GetCramSheetQueryHandlerTests()
    {
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);

        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(Array.Empty<MistakeEntry>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _cache.Setup(c => c.GetAsync<CramSheetDto>(It.IsAny<string>(), default)).ReturnsAsync((CramSheetDto?)null);
        _cache.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<CramSheetDto>(), It.IsAny<TimeSpan>(), default)).Returns(Task.CompletedTask);
        _ai.Setup(a => a.GeneralChatAsync(It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default)).ReturnsAsync("## Cram sheet");

        _handler = new GetCramSheetQueryHandler(_uow.Object, _ai.Object, _cache.Object);
    }

    private ExamPlan MakePlan(Guid? courseId = null) => new()
    {
        ExamPlanId = _planId,
        UserId = _userId,
        CourseId = courseId,
        Title = "Finals",
        ExamDate = DateTime.UtcNow.AddDays(5),
    };

    [Fact]
    public async Task Handle_PlanNotFound_ReturnsFailure()
    {
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(Array.Empty<ExamPlan>());

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PLAN_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoWeakMaterial_ReturnsFailure()
    {
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan() });

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_WEAK_MATERIAL", result.ErrorCode);
        _ai.Verify(a => a.GeneralChatAsync(It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_ReturnsCachedSheetWhenPresentAndNotRefreshing()
    {
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan() });
        var cached = new CramSheetDto(_planId, "Finals", DateTime.UtcNow, "cached markdown", DateTime.UtcNow);
        _cache.Setup(c => c.GetAsync<CramSheetDto>($"cram-sheet:{_userId}:{_planId}", default)).ReturnsAsync(cached);

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("cached markdown", result.Data!.Markdown);
        _ai.Verify(a => a.GeneralChatAsync(It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_RefreshTrue_BypassesCacheEvenWhenPresent()
    {
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan() });
        var cached = new CramSheetDto(_planId, "Finals", DateTime.UtcNow, "cached markdown", DateTime.UtcNow);
        _cache.Setup(c => c.GetAsync<CramSheetDto>(It.IsAny<string>(), default)).ReturnsAsync(cached);
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { UserId = _userId, Status = "open", Question = "Q", CorrectAnswer = "A" } });

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId, Refresh: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("## Cram sheet", result.Data!.Markdown);
        _ai.Verify(a => a.GeneralChatAsync(It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_WithOpenMistakes_GeneratesAndCachesSheet()
    {
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan() });
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { UserId = _userId, Status = "open", Question = "Q", CorrectAnswer = "A" } });

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("## Cram sheet", result.Data!.Markdown);
        _cache.Verify(c => c.SetAsync($"cram-sheet:{_userId}:{_planId}", It.IsAny<CramSheetDto>(), It.IsAny<TimeSpan>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExcludesMasteredTermsAndTermsMissingTextFromWeakMaterial()
    {
        var mastered = Guid.NewGuid();
        var incomplete = Guid.NewGuid();
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan() });
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { mastered });
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = mastered, UserId = _userId, Term = "Mastered", Definition = "def" },
            new GlossaryTerm { GlossaryTermId = incomplete, UserId = _userId, Term = "", Definition = "" },
        });

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_WEAK_MATERIAL", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseScopedPlan_ExcludesMistakesOutsideCourse()
    {
        var courseId = Guid.NewGuid();
        var docInCourse = Guid.NewGuid();
        var docOutOfCourse = Guid.NewGuid();
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { MakePlan(courseId) });
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = docInCourse, UserId = _userId, CourseId = courseId },
            new Document { DocumentId = docOutOfCourse, UserId = _userId, CourseId = Guid.NewGuid() },
        });
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(new[]
        {
            new MistakeEntry { UserId = _userId, Status = "open", DocumentId = docInCourse, Question = "In course", CorrectAnswer = "A" },
            new MistakeEntry { UserId = _userId, Status = "open", DocumentId = docOutOfCourse, Question = "Out of course", CorrectAnswer = "A" },
        });
        string? capturedPrompt = null;
        _ai.Setup(a => a.GeneralChatAsync(It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default))
            .Callback<IEnumerable<(string, string)>, string, CancellationToken>((_, prompt, _) => capturedPrompt = prompt)
            .ReturnsAsync("sheet");

        var result = await _handler.Handle(new GetCramSheetQuery(_userId, _planId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains("In course", capturedPrompt);
        Assert.DoesNotContain("Out of course", capturedPrompt);
    }
}
