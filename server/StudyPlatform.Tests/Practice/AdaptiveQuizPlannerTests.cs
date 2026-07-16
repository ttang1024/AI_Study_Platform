using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Practice;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class AdaptiveQuizPlannerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly AdaptiveQuizPlanner _planner;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();

    public AdaptiveQuizPlannerTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);

        Given(submissions: [], mistakes: [], flashcards: [], srs: []);

        _planner = new AdaptiveQuizPlanner(_uow.Object);
    }

    private void Given(
        QuizSubmission[] submissions,
        MistakeEntry[] mistakes,
        Flashcard[] flashcards,
        FlashcardSrsData[] srs)
    {
        _submissions
            .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(submissions);
        _mistakes
            .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(mistakes);
        _flashcards
            .Setup(r => r.GetByDocumentIdAsync(_docId, default))
            .ReturnsAsync(flashcards);
        _srs
            .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(srs);
    }

    private QuizSubmission Submission(int score, int total) => new()
    {
        SubmissionId = Guid.NewGuid(),
        UserId = _userId,
        DocumentId = _docId,
        Score = score,
        Total = total,
        SubmittedAt = DateTime.UtcNow,
    };

    private MistakeEntry Mistake(string question, int timesMissed = 1) => new()
    {
        MistakeEntryId = Guid.NewGuid(),
        UserId = _userId,
        DocumentId = _docId,
        Question = question,
        Status = "open",
        TimesMissed = timesMissed,
        LastMissedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task PlanAsync_NoHistory_StartsAtMedium()
    {
        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(QuizDifficulty.Medium, plan.Difficulty);
        Assert.Empty(plan.FocusTopics);
    }

    [Fact]
    public async Task PlanAsync_HighAccuracy_StepsUpToHard()
    {
        Given([Submission(9, 10), Submission(10, 10)], [], [], []);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(QuizDifficulty.Hard, plan.Difficulty);
    }

    [Fact]
    public async Task PlanAsync_LowAccuracy_StepsDownToEasy()
    {
        Given([Submission(4, 10)], [], [], []);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(QuizDifficulty.Easy, plan.Difficulty);
    }

    [Fact]
    public async Task PlanAsync_MidAccuracy_StaysMedium()
    {
        Given([Submission(7, 10)], [], [], []);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(QuizDifficulty.Medium, plan.Difficulty);
    }

    /// <summary>
    /// A high average can be carried by easy questions while the same handful keep going wrong. The
    /// pile of unresolved mistakes is the stronger signal, and it must win.
    /// </summary>
    [Fact]
    public async Task PlanAsync_HighAccuracyButManyOpenMistakes_StepsDownToEasy()
    {
        Given(
            [Submission(10, 10)],
            [Mistake("q1"), Mistake("q2"), Mistake("q3"), Mistake("q4"), Mistake("q5")],
            [],
            []);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(QuizDifficulty.Easy, plan.Difficulty);
    }

    [Fact]
    public async Task PlanAsync_OrdersFocusTopicsByTimesMissed()
    {
        Given(
            [Submission(7, 10)],
            [Mistake("rarely missed", timesMissed: 1), Mistake("often missed", timesMissed: 4)],
            [],
            []);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(["often missed", "rarely missed"], plan.FocusTopics);
    }

    /// <summary>A card that has never been reviewed is new, not forgotten — it is not evidence of a gap.</summary>
    [Fact]
    public async Task PlanAsync_IgnoresUnreviewedCards()
    {
        var newCard = new Flashcard { FlashcardId = Guid.NewGuid(), UserId = _userId, Front = "never seen", Back = "b" };
        var lapsedCard = new Flashcard { FlashcardId = Guid.NewGuid(), UserId = _userId, Front = "keeps lapsing", Back = "b" };

        Given(
            [Submission(7, 10)],
            [],
            [newCard, lapsedCard],
            [
                new FlashcardSrsData { UserId = _userId, FlashcardId = newCard.FlashcardId, Reps = 0, Stability = 0 },
                new FlashcardSrsData { UserId = _userId, FlashcardId = lapsedCard.FlashcardId, Reps = 3, Stability = 2, Lapses = 2 },
            ]);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(["keeps lapsing"], plan.FocusTopics);
    }

    [Fact]
    public async Task PlanAsync_PutsMissedQuestionsAheadOfForgottenCards()
    {
        var card = new Flashcard { FlashcardId = Guid.NewGuid(), UserId = _userId, Front = "forgotten card", Back = "b" };

        Given(
            [Submission(7, 10)],
            [Mistake("missed question")],
            [card],
            [new FlashcardSrsData { UserId = _userId, FlashcardId = card.FlashcardId, Reps = 2, Stability = 1, Lapses = 1 }]);

        var plan = await _planner.PlanAsync(_userId, _docId);

        Assert.Equal(["missed question", "forgotten card"], plan.FocusTopics);
    }
}
