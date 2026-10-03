using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Practice.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class GeneratePracticeTestQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly GeneratePracticeTestQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GeneratePracticeTestQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);

        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(Array.Empty<WorkedProblem>());

        _handler = new GeneratePracticeTestQueryHandler(_uow.Object);
    }

    private static Quiz MakeQuiz(Guid userId, string correctAnswer, string[] options, Guid? docId = null) => new()
    {
        QuizId = Guid.NewGuid(), UserId = userId, DocumentId = docId,
        Question = "Q", OptionsJson = JsonSerializer.Serialize(options), CorrectAnswer = correctAnswer, Explanation = "E", Difficulty = "medium",
    };

    [Fact]
    public async Task Handle_NoSourcesSpecified_DefaultsToAllSources()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A", "B" }) });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "F", Back = "B" } });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, Array.Empty<string>()), default);

        Assert.True(result.IsSuccess);
        var sources = result.Data!.Questions.Select(q => q.Source).ToHashSet();
        Assert.Contains("quiz", sources);
        Assert.Contains("flashcard", sources);
    }

    [Fact]
    public async Task Handle_RestrictedSources_OnlyPullsFromThoseSources()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A", "B" }) });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "F", Back = "B" } });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.All(result.Data!.Questions, q => Assert.Equal("quiz", q.Source));
    }

    [Fact]
    public async Task Handle_SourcesAreCaseInsensitiveAndTrimmed()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A", "B" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { " QUIZ " }), default);

        Assert.Single(result.Data!.Questions);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(100, 50)]
    public async Task Handle_ClampsCount(int requested, int maxExpected)
    {
        var quizzes = Enumerable.Range(0, 60).Select(_ => MakeQuiz(_userId, "A", new[] { "A", "B" })).ToList();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, requested, null, new[] { "quiz" }), default);

        Assert.True(result.Data!.Questions.Count <= maxExpected);
        Assert.True(result.Data.Questions.Count >= 1);
    }

    [Fact]
    public async Task Handle_QuizWithFewerThan2Options_IsExcluded()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_QuizWithMalformedOptionsJson_IsExcluded()
    {
        var quiz = MakeQuiz(_userId, "A", new[] { "A", "B" });
        quiz.OptionsJson = "{not json";
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_ResolvesCorrectAnswerByExactText()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "Paris", new[] { "London", "Paris" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Equal("Paris", result.Data!.Questions.Single().Answer);
    }

    [Fact]
    public async Task Handle_ResolvesCorrectAnswerByLetterIndex()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "B", new[] { "London", "Paris" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Equal("Paris", result.Data!.Questions.Single().Answer);
    }

    [Fact]
    public async Task Handle_UnresolvableCorrectAnswer_FallsBackToRawTrimmedText()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "  Something Else  ", new[] { "London", "Paris" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Equal("Something Else", result.Data!.Questions.Single().Answer);
    }

    [Fact]
    public async Task Handle_BlankExplanation_MapsToNull()
    {
        var quiz = MakeQuiz(_userId, "A", new[] { "A", "B" });
        quiz.Explanation = "   ";
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Null(result.Data!.Questions.Single().Explanation);
    }

    [Fact]
    public async Task Handle_CourseFilter_ExcludesQuestionsFromOtherCourses()
    {
        var courseId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = courseId } });
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[]
        {
            MakeQuiz(_userId, "A", new[] { "A", "B" }, docId), // in course
            MakeQuiz(_userId, "A", new[] { "A", "B" }, Guid.NewGuid()), // not attributable / different course
        });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, courseId, new[] { "quiz" }), default);

        Assert.Single(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_FlashcardWithClozeFront_BlanksItOut()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "{{Paris}} is the capital.", Back = "" } });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "flashcard" }), default);

        var q = Assert.Single(result.Data!.Questions);
        Assert.Contains("_____", q.Prompt);
        Assert.Equal("Paris", q.Answer);
    }

    [Fact]
    public async Task Handle_FlashcardWithBlankFrontAndBack_IsExcluded()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "Plain", Back = "" } });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "flashcard" }), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_GlossaryTermWithThreeDistractors_BecomesMultipleChoice()
    {
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "A", Definition = "def A" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "B", Definition = "def B" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "C", Definition = "def C" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "D", Definition = "def D" },
        });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "glossary" }), default);

        Assert.All(result.Data!.Questions, q => Assert.Equal("mc", q.Format));
    }

    [Fact]
    public async Task Handle_WorkedProblem_MapsStepsToNewlineJoinedString()
    {
        var problem = new WorkedProblem
        {
            WorkedProblemId = Guid.NewGuid(), UserId = _userId, ProblemText = "Solve for x",
            StepsJson = JsonSerializer.Serialize(new[] { "Step 1", "Step 2" }), FinalAnswer = "x=2", Difficulty = "medium",
        };
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(new[] { problem });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "problem" }), default);

        var q = Assert.Single(result.Data!.Questions);
        Assert.Equal("Step 1\nStep 2", q.Explanation);
        Assert.Equal("x=2", q.Answer);
    }

    [Fact]
    public async Task Handle_WorkedProblemWithBlankStepsJson_HasNullExplanation()
    {
        var problem = new WorkedProblem { WorkedProblemId = Guid.NewGuid(), UserId = _userId, ProblemText = "Solve", StepsJson = "", FinalAnswer = "x" };
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(new[] { problem });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "problem" }), default);

        Assert.Null(result.Data!.Questions.Single().Explanation);
    }

    [Fact]
    public async Task Handle_WorkedProblemWithBlankProblemText_IsExcluded()
    {
        var problem = new WorkedProblem { WorkedProblemId = Guid.NewGuid(), UserId = _userId, ProblemText = "   ", FinalAnswer = "x" };
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(new[] { problem });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "problem" }), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_RoundRobinsAcrossPoolsRatherThanExhaustingOneFirst()
    {
        var quizzes = Enumerable.Range(0, 5).Select(_ => MakeQuiz(_userId, "A", new[] { "A", "B" })).ToList();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);
        var cards = Enumerable.Range(0, 5).Select(_ => new Flashcard { FlashcardId = Guid.NewGuid(), Front = "F", Back = "B" }).ToList();
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(cards);

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 4, null, new[] { "quiz", "flashcard" }), default);

        var quizCount = result.Data!.Questions.Count(q => q.Source == "quiz");
        var cardCount = result.Data.Questions.Count(q => q.Source == "flashcard");
        Assert.Equal(2, quizCount);
        Assert.Equal(2, cardCount);
    }

    [Fact]
    public async Task Handle_CountLargerThanAvailablePool_ReturnsWhatIsAvailable()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A", "B" }) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, null, new[] { "quiz" }), default);

        Assert.Single(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_InterleaveCourses_AlternatesConsecutiveQuestionsAcrossCourses()
    {
        var courseA = Guid.NewGuid();
        var courseB = Guid.NewGuid();
        var docA = Guid.NewGuid();
        var docB = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = docA, UserId = _userId, CourseId = courseA },
            new Document { DocumentId = docB, UserId = _userId, CourseId = courseB },
        });
        var quizzes = Enumerable.Range(0, 3).Select(_ => MakeQuiz(_userId, "A", new[] { "A", "B" }, docA))
            .Concat(Enumerable.Range(0, 3).Select(_ => MakeQuiz(_userId, "A", new[] { "A", "B" }, docB)))
            .ToList();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 6, null, new[] { "quiz" }, InterleaveCourses: true), default);

        var courseSequence = result.Data!.Questions.Select(q => q.CourseId).ToList();
        // No two consecutive questions should share the same course id when both courses have equal pools.
        for (var i = 1; i < courseSequence.Count; i++)
            Assert.NotEqual(courseSequence[i - 1], courseSequence[i]);
    }

    [Fact]
    public async Task Handle_InterleaveCoursesIgnoredWhenCourseIdIsPinned()
    {
        var courseId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = courseId } });
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { MakeQuiz(_userId, "A", new[] { "A", "B" }, docId) });

        var result = await _handler.Handle(new GeneratePracticeTestQuery(_userId, 10, courseId, new[] { "quiz" }, InterleaveCourses: true), default);

        Assert.Single(result.Data!.Questions);
    }
}
