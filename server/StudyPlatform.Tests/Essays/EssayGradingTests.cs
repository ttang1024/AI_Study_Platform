using Moq;
using StudyPlatform.Application.Essays;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Essays;

/// <summary>
/// The score is recomputed from the model's own criterion breakdown rather than taken from whatever
/// overall figure it reports — those two are generated independently and routinely disagree.
/// </summary>
public class EssayScoreTests
{
    private const string Criteria =
        """[{"name":"Argument","maxPoints":10},{"name":"Evidence","maxPoints":10}]""";

    [Fact]
    public void TotalsTheCriterionBreakdown()
    {
        var feedback = """
            {"criteria":[
              {"name":"Argument","score":7,"maxPoints":10},
              {"name":"Evidence","score":8,"maxPoints":10}
            ]}
            """;

        Assert.Equal(75.0, GradeEssayCommandHandler.ScoreFromFeedback(feedback, Criteria));
    }

    [Fact]
    public void IgnoresAnyOverallScoreTheModelReports()
    {
        // The model claims 95% while its own breakdown adds up to 50%. The breakdown is what the
        // user can see and argue with, so it wins.
        var feedback = """
            {"overallScore":95,"score":95,"criteria":[
              {"name":"Argument","score":5,"maxPoints":10},
              {"name":"Evidence","score":5,"maxPoints":10}
            ]}
            """;

        Assert.Equal(50.0, GradeEssayCommandHandler.ScoreFromFeedback(feedback, Criteria));
    }

    [Fact]
    public void ClampsACriterionScoreToItsMaximum()
    {
        // A model awarding 15/10 would otherwise push the total over 100%.
        var feedback = """
            {"criteria":[
              {"name":"Argument","score":15,"maxPoints":10},
              {"name":"Evidence","score":10,"maxPoints":10}
            ]}
            """;

        Assert.Equal(100.0, GradeEssayCommandHandler.ScoreFromFeedback(feedback, Criteria));
    }

    [Fact]
    public void ClampsNegativeScoresToZero()
    {
        var feedback = """
            {"criteria":[
              {"name":"Argument","score":-4,"maxPoints":10},
              {"name":"Evidence","score":5,"maxPoints":10}
            ]}
            """;

        Assert.Equal(25.0, GradeEssayCommandHandler.ScoreFromFeedback(feedback, Criteria));
    }

    [Fact]
    public void SkipsCriteriaWithNoUsableMaximum()
    {
        var feedback = """
            {"criteria":[
              {"name":"Argument","score":8,"maxPoints":10},
              {"name":"Broken","score":5,"maxPoints":0}
            ]}
            """;

        Assert.Equal(80.0, GradeEssayCommandHandler.ScoreFromFeedback(feedback, Criteria));
    }

    [Fact]
    public void MissingCriteriaArray_IsNull()
    {
        // Null, not zero: "the grader failed" and "you scored nothing" are different outcomes.
        Assert.Null(GradeEssayCommandHandler.ScoreFromFeedback("""{"overallComment":"nice"}""", Criteria));
    }

    [Fact]
    public void MalformedJson_IsNull()
    {
        Assert.Null(GradeEssayCommandHandler.ScoreFromFeedback("not json at all", Criteria));
    }

    [Fact]
    public void EmptyCriteriaArray_IsNull()
    {
        Assert.Null(GradeEssayCommandHandler.ScoreFromFeedback("""{"criteria":[]}""", Criteria));
    }
}

public class GradeEssayCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly Mock<IAiService> _ai = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _essayId = Guid.NewGuid();
    private readonly Guid _rubricId = Guid.NewGuid();
    private readonly GradeEssayCommandHandler _handler;

    public GradeEssayCommandHandlerTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _handler = new GradeEssayCommandHandler(_uow.Object, _ai.Object);
    }

    private void EssayIs(EssaySubmission? essay) =>
        _essays.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync(essay);

    private void RubricIs(Rubric? rubric) =>
        _rubrics.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync(rubric);

    [Fact]
    public async Task DraftWithNoRubric_IsRefusedWithoutCallingTheModel()
    {
        EssayIs(new EssaySubmission { EssaySubmissionId = _essayId, UserId = _userId, RubricId = null });

        var result = await _handler.Handle(new GradeEssayCommand(_userId, _essayId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_RUBRIC", result.ErrorCode);
        _ai.Verify(a => a.GradeEssayAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task UnknownEssay_IsNotFound()
    {
        EssayIs(null);

        var result = await _handler.Handle(new GradeEssayCommand(_userId, _essayId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task UnparseableGraderResponse_LeavesTheDraftUngraded()
    {
        // A failed grade must not stamp a score or a GradedAt, or the UI would show the draft as
        // marked with no feedback behind it.
        var essay = new EssaySubmission { EssaySubmissionId = _essayId, UserId = _userId, RubricId = _rubricId };
        EssayIs(essay);
        RubricIs(new Rubric { RubricId = _rubricId, UserId = _userId, Name = "R", CriteriaJson = "[]" });
        _ai.Setup(a => a.GradeEssayAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("the model rambled instead of returning json");

        var result = await _handler.Handle(new GradeEssayCommand(_userId, _essayId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PARSE_ERROR", result.ErrorCode);
        Assert.Null(essay.ScorePercent);
        Assert.Null(essay.GradedAt);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task SuccessfulGrade_StoresFeedbackAndComputedScore()
    {
        var essay = new EssaySubmission { EssaySubmissionId = _essayId, UserId = _userId, RubricId = _rubricId };
        EssayIs(essay);
        RubricIs(new Rubric
        {
            RubricId = _rubricId,
            UserId = _userId,
            Name = "Essay rubric",
            CriteriaJson = """[{"name":"Argument","maxPoints":10}]""",
        });
        _ai.Setup(a => a.GradeEssayAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("""{"overallComment":"ok","criteria":[{"name":"Argument","score":6,"maxPoints":10}]}""");

        var result = await _handler.Handle(new GradeEssayCommand(_userId, _essayId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(60.0, essay.ScorePercent);
        Assert.NotNull(essay.GradedAt);
        Assert.Equal("Essay rubric", result.Data!.RubricName);
    }
}

public class SaveEssayCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly SaveEssayCommandHandler _handler;

    private EssaySubmission? _saved;

    public SaveEssayCommandHandlerTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _essays.Setup(r => r.AddAsync(It.IsAny<EssaySubmission>(), default))
            .Callback<EssaySubmission, CancellationToken>((e, _) => _saved = e)
            .Returns(Task.CompletedTask);

        _handler = new SaveEssayCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task FirstDraft_IsVersionOne()
    {
        await _handler.Handle(
            new SaveEssayCommand(_userId, null, null, "Title", null, "Two words here"), default);

        Assert.Equal(1, _saved!.Version);
        Assert.Equal(3, _saved.WordCount);
    }

    [Fact]
    public async Task Revision_IncrementsVersionAndInheritsTheRubric()
    {
        // Inheriting matters: re-marking a revision against a different scheme would make the
        // before/after comparison the feature exists for meaningless.
        var rubricId = Guid.NewGuid();
        var parentId = Guid.NewGuid();

        _essays.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync(new EssaySubmission
            {
                EssaySubmissionId = parentId, UserId = _userId, RubricId = rubricId, Version = 2,
            });

        await _handler.Handle(
            new SaveEssayCommand(_userId, null, parentId, "Title", null, "revised text"), default);

        Assert.Equal(3, _saved!.Version);
        Assert.Equal(rubricId, _saved.RubricId);
        Assert.Equal(parentId, _saved.ParentSubmissionId);
    }

    [Fact]
    public async Task RevisingSomeoneElsesDraft_IsNotFound()
    {
        _essays.Setup(r => r.FirstOrDefaultAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync((EssaySubmission?)null);

        var result = await _handler.Handle(
            new SaveEssayCommand(_userId, null, Guid.NewGuid(), "Title", null, "text"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }
}
