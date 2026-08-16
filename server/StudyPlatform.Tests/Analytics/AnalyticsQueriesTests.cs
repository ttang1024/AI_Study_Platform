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

public class GetDailyQuizAccuracyQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAnalyticsRepository> _analytics = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly GetDailyQuizAccuracyQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetDailyQuizAccuracyQueryHandlerTests()
    {
        _uow.Setup(u => u.Analytics).Returns(_analytics.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _analytics.Setup(r => r.GetQuizAttemptsByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<QuizAttempt>());
        _submissions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<QuizSubmission>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<DailyQuizAccuracyDto[]>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<DailyQuizAccuracyDto[]>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetDailyQuizAccuracyQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    private DateTime Day(int offset) => DateTime.UtcNow.Date.AddDays(offset);

    [Fact]
    public async Task Handle_NoActivity_ReturnsEmpty()
    {
        var result = await _handler.Handle(new GetDailyQuizAccuracyQuery(_userId, Day(-7), Day(0)), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_MergesAttemptsAndSubmissionsOnSameDay()
    {
        var day = Day(-1);
        _analytics.Setup(r => r.GetQuizAttemptsByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new QuizAttempt { AttemptId = Guid.NewGuid(), UserId = _userId, QuizId = Guid.NewGuid(), IsCorrect = true, AttemptedAt = day },
                new QuizAttempt { AttemptId = Guid.NewGuid(), UserId = _userId, QuizId = Guid.NewGuid(), IsCorrect = false, AttemptedAt = day },
            });
        _submissions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, AnswersJson = "{}", Score = 3, Total = 4, SubmittedAt = day },
            });

        var result = await _handler.Handle(new GetDailyQuizAccuracyQuery(_userId, Day(-7), Day(0)), default);

        var entry = Assert.Single(result.Data!);
        Assert.Equal(6, entry.TotalAttempts); // 2 attempts + 4 submission questions
        Assert.Equal(4, entry.CorrectAttempts); // 1 correct attempt + 3 correct submission
    }

    [Fact]
    public async Task Handle_ZeroTotalSubmission_IsIgnored()
    {
        var day = Day(-1);
        _submissions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, AnswersJson = "{}", Score = 0, Total = 0, SubmittedAt = day },
            });

        var result = await _handler.Handle(new GetDailyQuizAccuracyQuery(_userId, Day(-7), Day(0)), default);

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_AccuracyPercentIsRoundedCorrectly()
    {
        var day = Day(-1);
        _analytics.Setup(r => r.GetQuizAttemptsByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new QuizAttempt { AttemptId = Guid.NewGuid(), UserId = _userId, QuizId = Guid.NewGuid(), IsCorrect = true, AttemptedAt = day },
                new QuizAttempt { AttemptId = Guid.NewGuid(), UserId = _userId, QuizId = Guid.NewGuid(), IsCorrect = false, AttemptedAt = day },
                new QuizAttempt { AttemptId = Guid.NewGuid(), UserId = _userId, QuizId = Guid.NewGuid(), IsCorrect = false, AttemptedAt = day },
            });

        var result = await _handler.Handle(new GetDailyQuizAccuracyQuery(_userId, Day(-7), Day(0)), default);

        var entry = Assert.Single(result.Data!);
        Assert.Equal(33.33, entry.AccuracyPercentage);
    }
}

public class RecordQuizAttemptCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAnalyticsRepository> _analytics = new();
    private readonly RecordQuizAttemptCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RecordQuizAttemptCommandHandlerTests()
    {
        _uow.Setup(u => u.Analytics).Returns(_analytics.Object);
        _analytics.Setup(r => r.AddQuizAttemptAsync(It.IsAny<QuizAttempt>(), default)).Returns(Task.CompletedTask);
        _handler = new RecordQuizAttemptCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_RecordsAttemptAndSaves()
    {
        var quizId = Guid.NewGuid();
        QuizAttempt? captured = null;
        _analytics.Setup(r => r.AddQuizAttemptAsync(It.IsAny<QuizAttempt>(), default))
            .Callback<QuizAttempt, CancellationToken>((a, _) => captured = a)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new RecordQuizAttemptCommand(_userId, quizId, true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(quizId, captured!.QuizId);
        Assert.True(captured.IsCorrect);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}
