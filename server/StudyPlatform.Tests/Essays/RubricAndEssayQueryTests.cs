using Moq;
using StudyPlatform.Application.Essays;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Essays;

public class GetRubricsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly GetRubricsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetRubricsQueryHandlerTests()
    {
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _handler = new GetRubricsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedRubrics()
    {
        var rubric = new Rubric
        {
            RubricId = Guid.NewGuid(),
            UserId = _userId,
            Name = "Essay Rubric",
            CriteriaJson = """[{"name":"Argument","maxPoints":10},{"name":"Evidence","maxPoints":5}]""",
            UpdatedAt = DateTime.UtcNow,
        };
        _rubrics.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[] { rubric });

        var result = await _handler.Handle(new GetRubricsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal(15.0, dto.TotalPoints);
    }

    [Fact]
    public async Task Handle_NoRubrics_ReturnsEmpty()
    {
        _rubrics.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Rubric>());

        var result = await _handler.Handle(new GetRubricsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}

public class SaveRubricCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly SaveRubricCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SaveRubricCommandHandlerTests()
    {
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _rubrics.Setup(r => r.AddAsync(It.IsAny<Rubric>(), default)).Returns(Task.CompletedTask);
        _handler = new SaveRubricCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoRubricId_CreatesNewRubric()
    {
        var criteria = new[] { new RubricCriterionDto("Argument", null, 10) };

        var result = await _handler.Handle(new SaveRubricCommand(_userId, null, "New Rubric", null, criteria), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Rubric", result.Data!.Name);
        _rubrics.Verify(r => r.AddAsync(It.IsAny<Rubric>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExistingRubricId_UpdatesRubric()
    {
        var rubricId = Guid.NewGuid();
        var existing = new Rubric { RubricId = rubricId, UserId = _userId, Name = "Old", CriteriaJson = "[]" };
        _rubrics.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync(existing);
        var criteria = new[] { new RubricCriterionDto("Argument", null, 20) };

        var result = await _handler.Handle(new SaveRubricCommand(_userId, rubricId, "Updated Name", "Desc", criteria), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Updated Name", existing.Name);
        Assert.Equal("Desc", existing.Description);
        _rubrics.Verify(r => r.Update(existing), Times.Once);
        _rubrics.Verify(r => r.AddAsync(It.IsAny<Rubric>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_ExistingRubricNotFound_ReturnsFailure()
    {
        var rubricId = Guid.NewGuid();
        _rubrics.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync((Rubric?)null);

        var result = await _handler.Handle(new SaveRubricCommand(_userId, rubricId, "X", null, Array.Empty<RubricCriterionDto>()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TrimsNameAndDescription()
    {
        var criteria = new[] { new RubricCriterionDto("A", null, 5) };

        var result = await _handler.Handle(new SaveRubricCommand(_userId, null, "  Padded  ", "  Desc  ", criteria), default);

        Assert.Equal("Padded", result.Data!.Name);
        Assert.Equal("Desc", result.Data.Description);
    }
}

public class DeleteRubricCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly DeleteRubricCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _rubricId = Guid.NewGuid();

    public DeleteRubricCommandHandlerTests()
    {
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _handler = new DeleteRubricCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _rubrics.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync((Rubric?)null);

        var result = await _handler.Handle(new DeleteRubricCommand(_userId, _rubricId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_DeletesAndReturnsTrue()
    {
        var rubric = new Rubric { RubricId = _rubricId, UserId = _userId };
        _rubrics.Setup(r => r.FirstOrDefaultAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync(rubric);

        var result = await _handler.Handle(new DeleteRubricCommand(_userId, _rubricId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _rubrics.Verify(r => r.Remove(rubric), Times.Once);
    }
}

public class GetEssaysQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly GetEssaysQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetEssaysQueryHandlerTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _handler = new GetEssaysQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_AttachesRubricName()
    {
        var rubricId = Guid.NewGuid();
        _rubrics.Setup(r => r.GetByUserAsync(_userId, default))
            .ReturnsAsync(new[] { new Rubric { RubricId = rubricId, UserId = _userId, Name = "My Rubric" } });
        _essays.Setup(r => r.GetLatestByUserAsync(_userId, default))
            .ReturnsAsync(new[] { new EssaySubmission { EssaySubmissionId = Guid.NewGuid(), UserId = _userId, RubricId = rubricId, Title = "T", Text = "Body" } });

        var result = await _handler.Handle(new GetEssaysQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("My Rubric", result.Data!.Single().RubricName);
    }

    [Fact]
    public async Task Handle_NoRubric_ReturnsNullRubricName()
    {
        _rubrics.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Rubric>());
        _essays.Setup(r => r.GetLatestByUserAsync(_userId, default))
            .ReturnsAsync(new[] { new EssaySubmission { EssaySubmissionId = Guid.NewGuid(), UserId = _userId, RubricId = null, Title = "T", Text = "Body" } });

        var result = await _handler.Handle(new GetEssaysQuery(_userId), default);

        Assert.Null(result.Data!.Single().RubricName);
    }
}

public class GetEssayChainQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly GetEssayChainQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _submissionId = Guid.NewGuid();

    public GetEssayChainQueryHandlerTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _rubrics.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Rubric>());
        _handler = new GetEssayChainQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_EmptyChain_ReturnsFailure()
    {
        _essays.Setup(r => r.GetRevisionChainAsync(_userId, _submissionId, default)).ReturnsAsync(Array.Empty<EssaySubmission>());

        var result = await _handler.Handle(new GetEssayChainQuery(_userId, _submissionId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_HasChain_ReturnsAllRevisions()
    {
        _essays.Setup(r => r.GetRevisionChainAsync(_userId, _submissionId, default)).ReturnsAsync(new[]
        {
            new EssaySubmission { EssaySubmissionId = _submissionId, UserId = _userId, Title = "T", Text = "V1", Version = 1 },
            new EssaySubmission { EssaySubmissionId = Guid.NewGuid(), UserId = _userId, Title = "T", Text = "V2", Version = 2, ParentSubmissionId = _submissionId },
        });

        var result = await _handler.Handle(new GetEssayChainQuery(_userId, _submissionId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
    }
}

public class GetMyPeerReviewsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssayPeerReviewRepository> _reviews = new();
    private readonly GetMyPeerReviewsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMyPeerReviewsQueryHandlerTests()
    {
        _uow.Setup(u => u.EssayPeerReviews).Returns(_reviews.Object);
        _handler = new GetMyPeerReviewsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedAssignments()
    {
        var submission = new EssaySubmission { EssaySubmissionId = Guid.NewGuid(), Title = "Draft 1", WordCount = 250 };
        var review = new EssayPeerReview
        {
            EssayPeerReviewId = Guid.NewGuid(),
            EssaySubmissionId = submission.EssaySubmissionId,
            ReviewerUserId = _userId,
            Status = EssayPeerReviewStatus.Assigned,
            AssignedAt = DateTime.UtcNow,
            Submission = submission,
        };
        _reviews.Setup(r => r.GetAssignedToReviewerAsync(_userId, false, default)).ReturnsAsync(new[] { review });

        var result = await _handler.Handle(new GetMyPeerReviewsQuery(_userId, false), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal("Draft 1", dto.EssayTitle);
        Assert.Equal(250, dto.WordCount);
    }

    [Fact]
    public async Task Handle_NoAssignments_ReturnsEmpty()
    {
        _reviews.Setup(r => r.GetAssignedToReviewerAsync(_userId, true, default)).ReturnsAsync(Array.Empty<EssayPeerReview>());

        var result = await _handler.Handle(new GetMyPeerReviewsQuery(_userId, true), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}
