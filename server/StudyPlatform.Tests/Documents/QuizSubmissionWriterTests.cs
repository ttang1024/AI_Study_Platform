using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Documents;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class QuizSubmissionWriterTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly QuizSubmissionWriter _writer;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();
    private readonly List<QuizSubmission> _added = [];
    private readonly List<QuizSubmission> _updated = [];

    public QuizSubmissionWriterTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _submissions.Setup(r => r.AddAsync(It.IsAny<QuizSubmission>(), default))
            .Callback<QuizSubmission, CancellationToken>((s, _) => _added.Add(s))
            .Returns(Task.CompletedTask);
        _submissions.Setup(r => r.Update(It.IsAny<QuizSubmission>()))
            .Callback<QuizSubmission>(_updated.Add);
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), default))
            .ReturnsAsync((QuizSubmission?)null);
        _submissions.Setup(r => r.GetByVideoAndUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), default))
            .ReturnsAsync((QuizSubmission?)null);
        // No generated quizzes → MistakeCapture is a no-op, which keeps these tests about the upsert.
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Quiz>());
        _writer = new QuizSubmissionWriter(_uow.Object);
    }

    private static Dictionary<string, string> Answers(params (string quizId, string answer)[] pairs) =>
        pairs.ToDictionary(p => p.quizId, p => p.answer);

    [Fact]
    public async Task UpsertAsync_FirstAttemptOnADocument_InsertsARowTaggedToTheDocument()
    {
        await _writer.UpsertAsync(
            _userId, QuizSource.Document(_documentId), Answers(("q1", "A")), 1, 1, null);

        var row = Assert.Single(_added);
        Assert.Equal(_documentId, row.DocumentId);
        Assert.Null(row.VideoId);
        Assert.Equal("document", row.SourceType);
        Assert.Equal(_userId, row.UserId);
        Assert.Empty(_updated);
    }

    [Fact]
    public async Task UpsertAsync_FirstAttemptOnAVideo_InsertsARowTaggedToTheVideo()
    {
        await _writer.UpsertAsync(
            _userId, QuizSource.Video(_videoId), Answers(("q1", "A")), 1, 1, null);

        var row = Assert.Single(_added);
        Assert.Equal(_videoId, row.VideoId);
        Assert.Null(row.DocumentId);
        Assert.Equal("video", row.SourceType);
    }

    [Fact]
    public async Task UpsertAsync_LooksTheExistingRowUpByTheSourceItWasGiven()
    {
        await _writer.UpsertAsync(_userId, QuizSource.Video(_videoId), Answers(), 0, 0, null);

        _submissions.Verify(r => r.GetByVideoAndUserAsync(_videoId, _userId, default), Times.Once);
        _submissions.Verify(r => r.GetByDocumentAndUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task UpsertAsync_Retake_ReplacesTheAttemptRatherThanAppendingOne()
    {
        var existing = new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            DocumentId = _documentId,
            UserId = _userId,
            SourceType = "document",
            Score = 1,
            Total = 5,
            AnswersJson = "{}",
            SubmittedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(_documentId, _userId, default)).ReturnsAsync(existing);

        var dto = await _writer.UpsertAsync(
            _userId, QuizSource.Document(_documentId), Answers(("q1", "B")), 5, 5, null);

        // The UI shows one result per material, so a second row would just be unreachable history.
        Assert.Empty(_added);
        Assert.Same(existing, Assert.Single(_updated));
        Assert.Equal(5, existing.Score);
        Assert.Equal(5, existing.Total);
        Assert.Equal(existing.SubmissionId, dto.SubmissionId);
        Assert.True(existing.SubmittedAt > new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public async Task UpsertAsync_SerializesAnswersAsAQuizIdToAnswerMap()
    {
        await _writer.UpsertAsync(
            _userId, QuizSource.Document(_documentId), Answers(("q1", "A"), ("q2", "C")), 1, 2, null);

        var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(Assert.Single(_added).AnswersJson);
        Assert.Equal("A", parsed!["q1"]);
        Assert.Equal("C", parsed["q2"]);
    }

    [Fact]
    public async Task UpsertAsync_WithoutConfidence_LeavesItAbsentRatherThanZeroed()
    {
        await _writer.UpsertAsync(_userId, QuizSource.Document(_documentId), Answers(("q1", "A")), 1, 1, null);

        // Calibration has to tell "skipped the rating" apart from "rated it lowest".
        Assert.Null(Assert.Single(_added).ConfidenceJson);
    }

    [Fact]
    public async Task UpsertAsync_WithConfidence_StoresItAlongsideTheAnswers()
    {
        await _writer.UpsertAsync(
            _userId, QuizSource.Document(_documentId), Answers(("q1", "A")), 1, 1,
            new Dictionary<string, int> { ["q1"] = 3 });

        var row = Assert.Single(_added);
        Assert.NotNull(row.ConfidenceJson);
        Assert.Contains("q1", row.ConfidenceJson);
    }

    [Fact]
    public async Task UpsertAsync_SavesOnceAfterCapturingMistakes()
    {
        await _writer.UpsertAsync(_userId, QuizSource.Document(_documentId), Answers(("q1", "A")), 1, 1, null);

        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task UpsertAsync_FeedsTheMistakesNotebookFromTheSameSource()
    {
        await _writer.UpsertAsync(_userId, QuizSource.Video(_videoId), Answers(("q1", "A")), 0, 1, null);

        // MistakeCapture queries the user's quizzes for this source before upserting entries.
        _quizzes.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default), Times.Once);
    }

    [Fact]
    public void QuizSource_FactoriesTagTheDiscriminatorAndOnlyTheirOwnForeignKey()
    {
        var document = QuizSource.Document(_documentId);
        Assert.Equal("document", document.SourceType);
        Assert.Equal(_documentId, document.DocumentId);
        Assert.Null(document.VideoId);

        var video = QuizSource.Video(_videoId);
        Assert.Equal("video", video.SourceType);
        Assert.Equal(_videoId, video.VideoId);
        Assert.Null(video.DocumentId);
    }
}
