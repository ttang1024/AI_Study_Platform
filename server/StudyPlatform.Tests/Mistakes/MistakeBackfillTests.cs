using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Mistakes;

public class MistakeBackfillTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<MistakeEntry> _store = new();

    public MistakeBackfillTests()
    {
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        // The in-memory store stands in for the MistakeEntries table so the handler's
        // re-read after backfill sees what capture wrote.
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(() => _store.ToList());
        _mistakes.Setup(r => r.AddAsync(It.IsAny<MistakeEntry>(), default))
            .Callback<MistakeEntry, CancellationToken>((e, _) => _store.Add(e))
            .Returns(Task.CompletedTask);
    }

    [Fact]
    public async Task Handle_EmptyNotebookWithHistoricalSubmissions_BackfillsWrongAnswers()
    {
        var documentId = Guid.NewGuid();
        var quizRight = new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = documentId, SourceType = "document", Question = "Q1", CorrectAnswer = "A", OptionsJson = "[]" };
        var quizWrong = new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = documentId, SourceType = "document", Question = "Q2", CorrectAnswer = "B", OptionsJson = "[]" };
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { quizRight, quizWrong });

        var submittedAt = DateTime.UtcNow.AddDays(-10);
        var submission = new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            UserId = _userId,
            DocumentId = documentId,
            SourceType = "document",
            AnswersJson = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                [quizRight.QuizId.ToString()] = "A",  // correct
                [quizWrong.QuizId.ToString()] = "C",  // wrong
            }),
            Score = 1,
            Total = 2,
            SubmittedAt = submittedAt,
        };
        _submissions.Setup(r => r.FindAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(new[] { submission });

        var handler = new GetMistakesQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetMistakesQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var entry = Assert.Single(result.Data!.Items);
        Assert.Equal(quizWrong.QuizId, entry.QuizId);
        Assert.Equal("open", entry.Status);
        Assert.Equal("C", entry.UserAnswer);
        Assert.Equal(submittedAt, entry.FirstMissedAt);
        Assert.Equal(1, result.Data.OpenCount);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_NotebookAlreadyPopulated_DoesNotBackfill()
    {
        _store.Add(new MistakeEntry
        {
            MistakeEntryId = Guid.NewGuid(),
            UserId = _userId,
            Question = "Existing",
            OptionsJson = "[]",
            Status = "open",
        });

        var handler = new GetMistakesQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetMistakesQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Items);
        _submissions.Verify(r => r.FindAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}
