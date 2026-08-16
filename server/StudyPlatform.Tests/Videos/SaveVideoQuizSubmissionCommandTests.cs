using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Videos;

public class SaveVideoQuizSubmissionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly SaveVideoQuizSubmissionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();

    public SaveVideoQuizSubmissionCommandHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default))
            .ReturnsAsync(new Video { VideoId = _videoId, UserId = _userId });
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(Array.Empty<MistakeEntry>());
        _handler = new SaveVideoQuizSubmissionCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_VideoNotFound_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new SaveVideoQuizSubmissionCommand(_videoId, _userId, new(), 3, 5), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoExistingSubmission_CreatesNew()
    {
        _submissions.Setup(r => r.GetByVideoAndUserAsync(_videoId, _userId, default)).ReturnsAsync((QuizSubmission?)null);

        var result = await _handler.Handle(new SaveVideoQuizSubmissionCommand(_videoId, _userId, new() { ["q1"] = "A" }, 3, 5), default);

        Assert.True(result.IsSuccess);
        _submissions.Verify(r => r.AddAsync(It.IsAny<QuizSubmission>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExistingSubmission_UpdatesInPlace()
    {
        var existing = new QuizSubmission { SubmissionId = Guid.NewGuid(), VideoId = _videoId, UserId = _userId, Score = 1, Total = 5 };
        _submissions.Setup(r => r.GetByVideoAndUserAsync(_videoId, _userId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new SaveVideoQuizSubmissionCommand(_videoId, _userId, new() { ["q1"] = "A" }, 4, 5), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(4, existing.Score);
        _submissions.Verify(r => r.AddAsync(It.IsAny<QuizSubmission>(), default), Times.Never);
        _submissions.Verify(r => r.Update(existing), Times.Once);
    }

    [Fact]
    public async Task Handle_NoConfidence_StoresNullConfidenceJson()
    {
        _submissions.Setup(r => r.GetByVideoAndUserAsync(_videoId, _userId, default)).ReturnsAsync((QuizSubmission?)null);
        QuizSubmission? captured = null;
        _submissions.Setup(r => r.AddAsync(It.IsAny<QuizSubmission>(), default))
            .Callback<QuizSubmission, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveVideoQuizSubmissionCommand(_videoId, _userId, new(), 0, 0), default);

        Assert.Null(captured!.ConfidenceJson);
    }

    [Fact]
    public async Task Handle_WithConfidence_SerializesIt()
    {
        _submissions.Setup(r => r.GetByVideoAndUserAsync(_videoId, _userId, default)).ReturnsAsync((QuizSubmission?)null);
        QuizSubmission? captured = null;
        _submissions.Setup(r => r.AddAsync(It.IsAny<QuizSubmission>(), default))
            .Callback<QuizSubmission, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveVideoQuizSubmissionCommand(_videoId, _userId, new(), 1, 1, new() { ["q1"] = 3 }), default);

        Assert.NotNull(captured!.ConfidenceJson);
        Assert.Contains("q1", captured.ConfidenceJson);
    }
}
