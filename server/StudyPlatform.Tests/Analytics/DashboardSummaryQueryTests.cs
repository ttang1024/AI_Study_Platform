using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

/// <summary>
/// The dashboard's mistake count: a question counts as an open mistake once it has been answered wrong
/// and not since answered right. The counting walks every submission against the question bank, so the
/// tests here pin the source-matching rules that decide which questions a submission is graded against.
/// </summary>
public class DashboardSummaryQueryTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly Mock<IStreakCoverDayRepository> _covers = new();
    private readonly Mock<IUserRepository> _users = new();

    private readonly GetDashboardSummaryQueryHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<Quiz> _quizStore = new();
    private readonly List<QuizSubmission> _submissionStore = new();

    public DashboardSummaryQueryTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _uow.Setup(u => u.StreakCoverDays).Returns(_covers.Object);
        _uow.Setup(u => u.Users).Returns(_users.Object);

        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _quizStore.ToList());
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _submissionStore.ToList());

        _flashcards.Setup(r => r.CountByDifficultyAsync(_userId, "hard", It.IsAny<CancellationToken>())).ReturnsAsync(4);
        _terms.Setup(r => r.CountUnmasteredByUserAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _srs.Setup(r => r.CountDueByUserIdAsync(_userId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(11);

        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<StudySession>());
        _covers.Setup(r => r.GetByUserAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<StreakCoverDay>());
        _users.Setup(r => r.GetByIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { UserId = _userId, DailyStudyGoalMinutes = 45 });

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<DashboardSummaryDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<DashboardSummaryDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetDashboardSummaryQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    private Quiz AddQuiz(string correctAnswer, Guid? documentId = null, Guid? videoId = null)
    {
        var quiz = new Quiz
        {
            QuizId = Guid.NewGuid(),
            UserId = _userId,
            Question = "Q",
            CorrectAnswer = correctAnswer,
            OptionsJson = "[]",
            SourceType = videoId.HasValue ? "video" : "document",
            DocumentId = documentId,
            VideoId = videoId,
        };
        _quizStore.Add(quiz);
        return quiz;
    }

    private void AddSubmission(Guid? documentId, Guid? videoId, params (Quiz Quiz, string Given)[] answers)
        => _submissionStore.Add(new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            UserId = _userId,
            SourceType = videoId.HasValue ? "video" : "document",
            DocumentId = documentId,
            VideoId = videoId,
            AnswersJson = JsonSerializer.Serialize(answers.ToDictionary(a => a.Quiz.QuizId.ToString(), a => a.Given)),
            Total = answers.Length,
            SubmittedAt = DateTime.UtcNow,
        });

    private async Task<ReinforcementCountsDto> Run()
    {
        var result = await _handler.Handle(new GetDashboardSummaryQuery(_userId), default);
        Assert.True(result.IsSuccess);
        return result.Data!.Reinforcement;
    }

    [Fact]
    public async Task CountsComeFromTheDatabase_NotFromMaterialisedLists()
    {
        var result = await _handler.Handle(new GetDashboardSummaryQuery(_userId), default);

        Assert.Equal(11, result.Data!.DueFlashcards);
        Assert.Equal(4, result.Data.Reinforcement.HardFlashcards);
        Assert.Equal(7, result.Data.Reinforcement.UnmasteredTerms);
        Assert.Equal(45, result.Data.DailyGoalMinutes);

        _flashcards.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _terms.Verify(r => r.GetByUserWithSourcesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _srs.Verify(r => r.GetDueByUserIdAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task WrongAnswer_CountsAsAMistake()
    {
        var documentId = Guid.NewGuid();
        var quiz = AddQuiz("A", documentId: documentId);
        AddSubmission(documentId, null, (quiz, "B"));

        Assert.Equal(1, (await Run()).QuizMistakes);
    }

    [Fact]
    public async Task AnsweredRightLater_ClearsTheMistake()
    {
        var documentId = Guid.NewGuid();
        var quiz = AddQuiz("A", documentId: documentId);
        AddSubmission(documentId, null, (quiz, "B"));
        AddSubmission(documentId, null, (quiz, "A"));

        Assert.Equal(0, (await Run()).QuizMistakes);
    }

    // A submission is graded against the questions belonging to its own source. Questions from another
    // document must not be dragged in, even when the answer keys happen not to name them.
    [Fact]
    public async Task QuestionsAreScopedToTheSubmissionsOwnSource()
    {
        var documentA = Guid.NewGuid();
        var documentB = Guid.NewGuid();
        var quizA = AddQuiz("A", documentId: documentA);
        AddQuiz("A", documentId: documentB);

        AddSubmission(documentA, null, (quizA, "wrong"));

        Assert.Equal(1, (await Run()).QuizMistakes);
    }

    [Fact]
    public async Task VideoAndDocumentSourcesAreKeptApart()
    {
        var videoId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        var videoQuiz = AddQuiz("A", videoId: videoId);
        var documentQuiz = AddQuiz("A", documentId: documentId);

        AddSubmission(null, videoId, (videoQuiz, "wrong"));
        AddSubmission(documentId, null, (documentQuiz, "A"));

        Assert.Equal(1, (await Run()).QuizMistakes);
    }

    // When nothing in the bank matches the submission's source — the source was deleted, or the
    // submission predates the source columns — grading falls back to whatever the answer keys resolve to.
    [Fact]
    public async Task UnmatchedSource_FallsBackToTheAnswerKeys()
    {
        var quiz = AddQuiz("A", documentId: Guid.NewGuid());
        AddSubmission(Guid.NewGuid(), null, (quiz, "wrong"));

        Assert.Equal(1, (await Run()).QuizMistakes);
    }

    [Fact]
    public async Task UnansweredQuestionsInASourceAreNotMistakes()
    {
        var documentId = Guid.NewGuid();
        var answered = AddQuiz("A", documentId: documentId);
        AddQuiz("A", documentId: documentId); // same source, never answered
        AddSubmission(documentId, null, (answered, "A"));

        Assert.Equal(0, (await Run()).QuizMistakes);
    }

    [Fact]
    public async Task NoQuizzes_ShortCircuitsWithoutReadingSubmissions()
    {
        Assert.Equal(0, (await Run()).QuizMistakes);
        _submissions.Verify(r => r.GetAllByUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
