using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class QuizCalibrationTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly GetQuizCalibrationQueryHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<QuizSubmission> _submissionStore = new();
    private readonly List<Quiz> _quizStore = new();

    public QuizCalibrationTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);

        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default))
            .ReturnsAsync(() => _submissionStore.ToList());

        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(() => _quizStore.ToList());

        _handler = new GetQuizCalibrationQueryHandler(_uow.Object);
    }

    private Quiz AddQuiz(string question, string correctAnswer)
    {
        var quiz = new Quiz
        {
            QuizId = Guid.NewGuid(),
            UserId = _userId,
            Question = question,
            CorrectAnswer = correctAnswer,
            OptionsJson = "[]",
        };
        _quizStore.Add(quiz);
        return quiz;
    }

    /// <summary>Records one submission: each entry is (quiz, the answer given, the confidence rated).</summary>
    private void AddSubmission(params (Quiz Quiz, string Given, int? Confidence)[] entries)
    {
        var answers = entries.ToDictionary(e => e.Quiz.QuizId.ToString(), e => e.Given);
        var confidence = entries
            .Where(e => e.Confidence.HasValue)
            .ToDictionary(e => e.Quiz.QuizId.ToString(), e => e.Confidence!.Value);

        _submissionStore.Add(new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            UserId = _userId,
            AnswersJson = JsonSerializer.Serialize(answers),
            ConfidenceJson = confidence.Count > 0 ? JsonSerializer.Serialize(confidence) : null,
            Total = entries.Length,
        });
    }

    private Task<StudyPlatform.Application.Common.Result<QuizCalibrationDto>> Run()
        => _handler.Handle(new GetQuizCalibrationQuery(_userId), default);

    [Fact]
    public async Task NoSubmissions_ReturnsEmptyBinsRatherThanFailing()
    {
        var result = await Run();

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.RatedAnswers);
        Assert.Equal(3, result.Data.Bins.Count); // the scale is always reported, even with no data
        Assert.Null(result.Data.OverconfidenceGap);
    }

    // Submissions made before confidence capture existed have a null ConfidenceJson. They must not be
    // read as "rated zero" — that would invent data.
    [Fact]
    public async Task SubmissionsWithoutConfidence_AreIgnored()
    {
        var quiz = AddQuiz("Q", "A");
        AddSubmission((quiz, "A", null));

        var result = await Run();

        Assert.Equal(0, result.Data!.RatedAnswers);
    }

    [Fact]
    public async Task ConfidentAndWrong_IsCountedAndListed()
    {
        var quiz = AddQuiz("Capital of Australia?", "Canberra");
        AddSubmission((quiz, "Sydney", ConfidenceLevel.Confident));

        var result = await Run();

        Assert.Equal(1, result.Data!.ConfidentWrong);
        var mistake = Assert.Single(result.Data.ConfidentMistakes);
        Assert.Equal("Capital of Australia?", mistake.Question);
        Assert.Equal("Canberra", mistake.CorrectAnswer);
        Assert.Equal("Sydney", mistake.YourAnswer);
    }

    [Fact]
    public async Task ConfidentAndRight_IsNotAMistake()
    {
        var quiz = AddQuiz("Q", "A");
        AddSubmission((quiz, "A", ConfidenceLevel.Confident));

        var result = await Run();

        Assert.Equal(0, result.Data!.ConfidentWrong);
        Assert.Empty(result.Data.ConfidentMistakes);
        Assert.Equal(0, result.Data.OverconfidenceGap); // certain and correct == perfectly calibrated
    }

    [Fact]
    public async Task OverconfidenceGap_IsTheDistanceBetweenBeingSureAndBeingRight()
    {
        var q1 = AddQuiz("Q1", "A");
        var q2 = AddQuiz("Q2", "A");
        var q3 = AddQuiz("Q3", "A");
        var q4 = AddQuiz("Q4", "A");
        // Confident on four, right on three => 75% accurate => 25 points overconfident.
        AddSubmission(
            (q1, "A", ConfidenceLevel.Confident),
            (q2, "A", ConfidenceLevel.Confident),
            (q3, "A", ConfidenceLevel.Confident),
            (q4, "B", ConfidenceLevel.Confident));

        var result = await Run();

        var confident = result.Data!.Bins.Single(b => b.Level == ConfidenceLevel.Confident);
        Assert.Equal(4, confident.Answered);
        Assert.Equal(3, confident.Correct);
        Assert.Equal(75, confident.AccuracyPercent);
        Assert.Equal(25, result.Data.OverconfidenceGap);
    }

    [Fact]
    public async Task GuessedRight_IsTrackedSeparately()
    {
        var quiz = AddQuiz("Q", "A");
        AddSubmission((quiz, "A", ConfidenceLevel.Guessing));

        var result = await Run();

        Assert.Equal(1, result.Data!.GuessedRight);
        // A lucky guess is still a correct answer; it just isn't knowledge.
        var guessing = result.Data.Bins.Single(b => b.Level == ConfidenceLevel.Guessing);
        Assert.Equal(100, guessing.AccuracyPercent);
    }

    [Fact]
    public async Task AnswersAreBinnedByTheLevelTheLearnerActuallyPicked()
    {
        var q1 = AddQuiz("Q1", "A");
        var q2 = AddQuiz("Q2", "A");
        var q3 = AddQuiz("Q3", "A");
        AddSubmission(
            (q1, "A", ConfidenceLevel.Guessing),
            (q2, "B", ConfidenceLevel.Unsure),
            (q3, "A", ConfidenceLevel.Confident));

        var result = await Run();

        Assert.Equal(3, result.Data!.RatedAnswers);
        Assert.Equal(1, result.Data.Bins.Single(b => b.Level == ConfidenceLevel.Guessing).Answered);
        Assert.Equal(1, result.Data.Bins.Single(b => b.Level == ConfidenceLevel.Unsure).Answered);
        Assert.Equal(1, result.Data.Bins.Single(b => b.Level == ConfidenceLevel.Confident).Answered);
    }

    // A rating whose quiz has since been deleted has nothing to be graded against.
    [Fact]
    public async Task RatingForAnUnknownQuiz_IsIgnored()
    {
        var quiz = AddQuiz("Q", "A");
        AddSubmission((quiz, "A", ConfidenceLevel.Confident));
        _quizStore.Clear();

        var result = await Run();

        Assert.Equal(0, result.Data!.RatedAnswers);
    }

    [Fact]
    public async Task PartiallyRatedSubmission_CountsOnlyTheRatedAnswers()
    {
        var rated = AddQuiz("Rated", "A");
        var skipped = AddQuiz("Skipped", "A");
        AddSubmission((rated, "A", ConfidenceLevel.Confident), (skipped, "B", null));

        var result = await Run();

        Assert.Equal(1, result.Data!.RatedAnswers);
        Assert.Equal(0, result.Data.ConfidentWrong);
    }

    // Grading goes through the same comparer the rest of the app uses, so "B) Paris" must grade as
    // correct against a stored answer of "Paris".
    [Fact]
    public async Task GradingToleratesTheAnswerFormatsTheModelEmits()
    {
        var quiz = AddQuiz("Capital of France?", "Paris");
        AddSubmission((quiz, "B) Paris", ConfidenceLevel.Confident));

        var result = await Run();

        Assert.Equal(0, result.Data!.ConfidentWrong);
    }
}
