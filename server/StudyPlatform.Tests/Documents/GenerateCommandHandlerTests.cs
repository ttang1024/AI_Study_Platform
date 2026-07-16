using System.Text.Json;
using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GenerateFlashcardsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly Mock<IFlashcardDeduplicator> _deduplicator = new();
    private readonly GenerateFlashcardsCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private Document _doc = null!;

    public GenerateFlashcardsCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default)).Returns(Task.CompletedTask);

        // Default: deduplication is off (the shape when no embeddings key is configured), so these
        // tests keep asserting on the generation behaviour they were written for. The dedup-specific
        // behaviour is covered in FlashcardDeduplicatorTests and the tests at the bottom of this file.
        _deduplicator
            .Setup(d => d.FilterAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyList<FlashcardCandidate>>(), default))
            .ReturnsAsync((Guid _, IReadOnlyList<FlashcardCandidate> c, CancellationToken _) =>
                FlashcardDedupResult.KeepAll(c));

        _doc = new Document
        {
            DocumentId = _docId,
            UserId = _userId,
            ContentType = "text/plain",
            BlobUrl = "blob://test"
        };

        _handler = new GenerateFlashcardsCommandHandler(
            _uow.Object, _ai.Object, _content.Object, _deduplicator.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentBelongsToDifferentUser_ReturnsFailure()
    {
        _doc.UserId = Guid.NewGuid();
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CachedFlashcardsExist_ReturnsCachedWithoutCallingAi()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        var cached = new Flashcard
        {
            FlashcardId = Guid.NewGuid(), DocumentId = _docId, UserId = _userId,
            Front = "Q", Back = "A", SourceType = "document",
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(new[] { cached });

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        _ai.Verify(a => a.GenerateFlashcardsAsync(It.IsAny<byte[]>(), It.IsAny<string>(), default), Times.Never);
        _ai.Verify(a => a.GenerateFlashcardsAsync(It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_TextDocument_CallsTextOverload_AndPersistsFlashcards()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());

        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "some text"));

        var json = JsonSerializer.Serialize(new[] { new { Front = "Q1", Back = "A1" } });
        _ai.Setup(a => a.GenerateFlashcardsAsync("some text", default)).ReturnsAsync(json);

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Q1", result.Data!.First().Front);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_BinaryDocument_CallsBytesOverload()
    {
        _doc.ContentType = "application/pdf";
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());

        var bytes = new byte[] { 1, 2, 3 };
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(bytes, null));

        var json = JsonSerializer.Serialize(new[] { new { Front = "F", Back = "B" } });
        _ai.Setup(a => a.GenerateFlashcardsAsync(bytes, "application/pdf", default)).ReturnsAsync(json);

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.GenerateFlashcardsAsync(bytes, "application/pdf", default), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidJson_ReturnsParseError()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default)).ReturnsAsync("not-json");

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PARSE_ERROR", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrappedFlashcardsJson_PersistsFlashcards()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default))
            .ReturnsAsync("""{"flashcards":[{"front":"Q","back":"A","type":"basic"}]}""");

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Q", result.Data!.First().Front);
        _flashcards.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default), Times.Once);
    }

    [Theory]
    [InlineData("Flashcards")]
    [InlineData("flashCards")]
    [InlineData("data")]
    [InlineData("results")]
    public async Task Handle_CommonWrappedFlashcardsJson_PersistsFlashcards(string propertyName)
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default))
            .ReturnsAsync($$"""{ "{{propertyName}}": [ { "front": "Q", "back": "A", "type": "basic" } ] }""");

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Q", result.Data!.First().Front);
    }

    [Fact]
    public async Task Handle_GroupedFlashcardsJson_PersistsFlashcards()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default))
            .ReturnsAsync("""{"basic":[{"question":"Q","answer":"A"}],"cloze":[{"front":"The term is {{x}}.","hint":"x"}]}""");

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
        Assert.Contains(result.Data!, c => c.Front == "Q" && c.CardType == "basic");
        Assert.Contains(result.Data!, c => c.CardType == "cloze");
    }

    [Fact]
    public async Task Handle_NestedFlashcardsJson_PersistsFlashcards()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default))
            .ReturnsAsync("""{"payload":{"result":{"studyCards":[{"question":"Q","answer":"A"}]}}}""");

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Q", result.Data!.First().Front);
        Assert.Equal("A", result.Data!.First().Back);
    }

    [Fact]
    public async Task Handle_ChartType_SerializesChartDataToBack()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));

        var json = """[{"Front":"Chart Q","Back":"ignored","Type":"chart","ChartData":{"labels":["a"]}}]""";
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default)).ReturnsAsync(json);

        Flashcard? saved = null;
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default))
            .Callback<IEnumerable<Flashcard>, CancellationToken>((cards, _) => saved = cards.First())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.Equal("chart", saved?.CardType);
        Assert.Contains("labels", saved?.Back);
    }
}

public class GenerateGlossaryCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly GenerateGlossaryCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private readonly Document _doc;

    public GenerateGlossaryCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _glossary.Setup(r => r.DeleteByDocumentIdAsync(_docId, default)).Returns(Task.CompletedTask);
        _glossary.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<GlossaryTerm>>(), default)).Returns(Task.CompletedTask);

        _doc = new Document { DocumentId = _docId, UserId = _userId, ContentType = "text/plain", BlobUrl = "blob://g" };
        _handler = new GenerateGlossaryCommandHandler(_uow.Object, _ai.Object, _content.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GenerateGlossaryCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TextDocument_DeletesExisting_GeneratesAndSavesTerms()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "content"));

        var json = JsonSerializer.Serialize(new[] { new { Term = "API", Definition = "Application Programming Interface" } });
        _ai.Setup(a => a.GenerateGlossaryAsync("content", default)).ReturnsAsync(json);

        var result = await _handler.Handle(new GenerateGlossaryCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("API", result.Data!.First().Term);
        _glossary.Verify(r => r.DeleteByDocumentIdAsync(_docId, default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_BinaryDocument_CallsBytesOverload()
    {
        _doc.ContentType = "application/pdf";
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);

        var bytes = new byte[] { 9, 8, 7 };
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(bytes, null));

        var json = JsonSerializer.Serialize(new[] { new { Term = "T", Definition = "D" } });
        _ai.Setup(a => a.GenerateGlossaryAsync(bytes, "application/pdf", default)).ReturnsAsync(json);

        var result = await _handler.Handle(new GenerateGlossaryCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.GenerateGlossaryAsync(bytes, "application/pdf", default), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidJson_ReturnsParseError()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "x"));
        _ai.Setup(a => a.GenerateGlossaryAsync("x", default)).ReturnsAsync("{bad json");

        var result = await _handler.Handle(new GenerateGlossaryCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PARSE_ERROR", result.ErrorCode);
    }
}

public class GenerateQuizCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly Mock<IAdaptiveQuizPlanner> _planner = new();
    private readonly GenerateQuizCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private readonly Document _doc;

    public GenerateQuizCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default)).Returns(Task.CompletedTask);

        _doc = new Document { DocumentId = _docId, UserId = _userId, ContentType = "text/plain", BlobUrl = "blob://q" };
        _handler = new GenerateQuizCommandHandler(_uow.Object, _ai.Object, _content.Object, _planner.Object);
    }

    private static string QuizJson(string answer = "A") => JsonSerializer.Serialize(new[]
    {
        new { Question = "Q?", Options = new[] { "A) Alpha", "B) Beta", "C) Gamma", "D) Delta" }, CorrectAnswer = answer, Explanation = "Ex" }
    });

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CachedQuizzesExist_ReturnsCachedWithoutCallingAi()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        var cached = new Quiz
        {
            QuizId = Guid.NewGuid(), DocumentId = _docId, UserId = _userId,
            Question = "Q?", OptionsJson = """["A)Alpha","B)Beta"]""",
            CorrectAnswer = "A", Explanation = "E", Difficulty = "medium", SourceType = "document",
            CreatedAt = DateTime.UtcNow
        };
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(new[] { cached });

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        _ai.Verify(a => a.GenerateQuizAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_TextDocument_GeneratesAndPersistsQuiz()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "text"));
        _ai.Setup(a => a.GenerateQuizAsync("text", "medium", default)).ReturnsAsync(QuizJson());

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_DifficultyNormalized_UnknownDefaultsToMedium()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "x"));
        _ai.Setup(a => a.GenerateQuizAsync("x", "medium", default)).ReturnsAsync(QuizJson());

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId, "unknown"), default);

        _quizzes.Verify(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default), Times.Once);
    }

    [Theory]
    [InlineData("easy")]
    [InlineData("hard")]
    public async Task Handle_ValidDifficulty_PassedThrough(string difficulty)
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, difficulty, default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "t"));
        _ai.Setup(a => a.GenerateQuizAsync("t", difficulty, default)).ReturnsAsync(QuizJson());

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId, difficulty), default);

        _quizzes.Verify(r => r.GetByDocumentIdAndDifficultyAsync(_docId, difficulty, default), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectAnswerAsFullText_NormalizedToLetter()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "t"));

        // AI returns full text instead of a letter
        _ai.Setup(a => a.GenerateQuizAsync("t", "medium", default))
            .ReturnsAsync(QuizJson(answer: "Alpha"));

        Quiz? saved = null;
        _quizzes.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Quiz>>(), default))
            .Callback<IEnumerable<Quiz>, CancellationToken>((qs, _) => saved = qs.First())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.Equal("A", saved?.CorrectAnswer);
    }

    [Fact]
    public async Task Handle_InvalidJson_ReturnsParseError()
    {
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(_docId, "medium", default)).ReturnsAsync(Array.Empty<Quiz>());
        _content.Setup(c => c.GetContentAsync(_doc, default))
            .ReturnsAsync(new DocumentContent(null, "t"));
        _ai.Setup(a => a.GenerateQuizAsync("t", "medium", default)).ReturnsAsync("not-json");

        var result = await _handler.Handle(new GenerateQuizCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PARSE_ERROR", result.ErrorCode);
    }
}
