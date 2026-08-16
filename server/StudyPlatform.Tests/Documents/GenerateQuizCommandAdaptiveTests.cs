using System.Text.Json;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

/// <summary>Covers the adaptive-quiz path and the answer-normalization fallbacks not exercised by
/// <c>GenerateQuizCommandHandlerTests</c>.</summary>
public class GenerateQuizCommandAdaptiveTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly Mock<IDocumentTextProvider> _textProvider = new();
    private readonly Mock<IAdaptiveQuizPlanner> _planner = new();
    private readonly GenerateQuizCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private readonly Document _doc;

    public GenerateQuizCommandAdaptiveTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default)).Returns(Task.CompletedTask);
        _quizzes.Setup(r => r.RemoveRange(It.IsAny<IEnumerable<Quiz>>()));

        _doc = new Document { DocumentId = _docId, UserId = _userId, ContentType = "text/plain", BlobUrl = "blob://q", ContentVersion = 1 };
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _handler = new GenerateQuizCommandHandler(
            _uow.Object, _ai.Object, _content.Object, _planner.Object, _textProvider.Object);
    }

    private static string QuizJson(string answer = "A") => JsonSerializer.Serialize(new[]
    {
        new { Question = "Q?", Options = new[] { "A) Alpha", "B) Beta", "C) Gamma", "D) Delta" }, CorrectAnswer = answer, Explanation = "Ex" }
    });

    [Fact]
    public async Task Handle_Adaptive_ClearsPreviousAdaptiveQuizzesAndGeneratesNew()
    {
        var plan = new QuizPlan("advanced", new[] { "Recursion" }, "Because you missed recursion questions.");
        _planner.Setup(p => p.PlanAsync(_userId, _docId, default)).ReturnsAsync(plan);
        var stalePrevious = new[] { new Quiz { QuizId = Guid.NewGuid(), DocumentId = _docId, UserId = _userId, Difficulty = QuizDifficulty.Adaptive, Question = "Old", OptionsJson = "[]", CorrectAnswer = "A" } };
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, QuizDifficulty.Adaptive, default)).ReturnsAsync(stalePrevious);
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateAdaptiveQuizAsync("text", plan, default)).ReturnsAsync(QuizJson());

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId, "adaptive"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Because you missed recursion questions.", result.Message);
        _quizzes.Verify(r => r.RemoveRange(stalePrevious), Times.Once);
        _ai.Verify(a => a.GenerateAdaptiveQuizAsync("text", plan, default), Times.Once);
    }

    [Fact]
    public async Task Handle_Adaptive_NoStalePreviousQuizzes_SkipsRemoveAndExtraSave()
    {
        var plan = new QuizPlan("beginner", Array.Empty<string>(), "Starting fresh.");
        _planner.Setup(p => p.PlanAsync(_userId, _docId, default)).ReturnsAsync(plan);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, QuizDifficulty.Adaptive, default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateAdaptiveQuizAsync("text", plan, default)).ReturnsAsync(QuizJson());

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId, "adaptive"), default);

        Assert.True(result.IsSuccess);
        _quizzes.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<Quiz>>()), Times.Never);
    }

    [Fact]
    public async Task Handle_Adaptive_DoesNotUseCachedQuizzesEvenIfPresent()
    {
        var plan = new QuizPlan("intermediate", Array.Empty<string>(), "Mixed review.");
        _planner.Setup(p => p.PlanAsync(_userId, _docId, default)).ReturnsAsync(plan);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, QuizDifficulty.Adaptive, default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateAdaptiveQuizAsync("text", plan, default)).ReturnsAsync(QuizJson());

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId, "adaptive"), default);

        _ai.Verify(a => a.GenerateAdaptiveQuizAsync("text", plan, default), Times.Once);
        _quizzes.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_AdaptiveWithPdfBytes_UsesBytesOverload()
    {
        var plan = new QuizPlan("advanced", Array.Empty<string>(), "Rationale.");
        _planner.Setup(p => p.PlanAsync(_userId, _docId, default)).ReturnsAsync(plan);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, QuizDifficulty.Adaptive, default)).ReturnsAsync(Array.Empty<Quiz>());
        var bytes = new byte[] { 1, 2, 3 };
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(bytes, null));
        _ai.Setup(a => a.GenerateAdaptiveQuizAsync(bytes, _doc.ContentType, plan, default)).ReturnsAsync(QuizJson());

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId, "adaptive"), default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.GenerateAdaptiveQuizAsync(bytes, _doc.ContentType, plan, default), Times.Once);
    }

    [Fact]
    public async Task Handle_PdfBytes_NonAdaptive_UsesBytesOverload()
    {
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        var bytes = new byte[] { 9, 9 };
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(bytes, null));
        _ai.Setup(a => a.GenerateQuizAsync(bytes, _doc.ContentType, "medium", default)).ReturnsAsync(QuizJson());

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.GenerateQuizAsync(bytes, _doc.ContentType, "medium", default), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectAnswerMatchesBySemanticMeaning_NormalizedToLetter()
    {
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "t"));
        // Model returns punctuation/casing that only matches via meaning-normalization, not raw text.
        _ai.Setup(a => a.GenerateQuizAsync("t", "medium", default)).ReturnsAsync(QuizJson(answer: "  alpha!!  "));

        Quiz? saved = null;
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default))
            .Callback<IEnumerable<Quiz>, CancellationToken>((qs, _) => saved = qs.First())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.Equal("A", saved?.CorrectAnswer);
    }

    [Fact]
    public async Task Handle_CorrectAnswerMatchesNoOption_ReturnsTrimmedTextVerbatim()
    {
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "t"));
        _ai.Setup(a => a.GenerateQuizAsync("t", "medium", default)).ReturnsAsync(QuizJson(answer: "  Something Else Entirely  "));

        Quiz? saved = null;
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default))
            .Callback<IEnumerable<Quiz>, CancellationToken>((qs, _) => saved = qs.First())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.Equal("Something Else Entirely", saved?.CorrectAnswer);
    }
}
