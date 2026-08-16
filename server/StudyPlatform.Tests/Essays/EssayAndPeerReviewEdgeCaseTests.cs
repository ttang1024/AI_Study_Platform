using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Essays;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Essays;

public class SaveEssayCommandEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly SaveEssayCommandHandler _handler;

    public SaveEssayCommandEdgeCaseTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _essays.Setup(r => r.AddAsync(It.IsAny<EssaySubmission>(), default)).Returns(Task.CompletedTask);
        _handler = new SaveEssayCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ParentSubmissionNotFound_ReturnsFailure()
    {
        var parentId = Guid.NewGuid();
        _essays.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync((EssaySubmission?)null);

        var result = await _handler.Handle(new SaveEssayCommand(_userId, null, parentId, "Title", null, "text"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ExplicitRubricId_OverridesParentsRubric()
    {
        var parentId = Guid.NewGuid();
        var parentRubricId = Guid.NewGuid();
        var overrideRubricId = Guid.NewGuid();
        _essays.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync(new EssaySubmission { EssaySubmissionId = parentId, UserId = _userId, RubricId = parentRubricId, Version = 1 });

        EssaySubmission? saved = null;
        _essays.Setup(r => r.AddAsync(It.IsAny<EssaySubmission>(), default))
            .Callback<EssaySubmission, CancellationToken>((e, _) => saved = e)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveEssayCommand(_userId, overrideRubricId, parentId, "Title", null, "text"), default);

        Assert.Equal(overrideRubricId, saved!.RubricId);
    }
}

public class GradeEssayCommandRubricGoneTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _essays = new();
    private readonly Mock<IRubricRepository> _rubrics = new();
    private readonly Mock<Application.Services.IAiService> _ai = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _essayId = Guid.NewGuid();
    private readonly Guid _rubricId = Guid.NewGuid();
    private readonly GradeEssayCommandHandler _handler;

    public GradeEssayCommandRubricGoneTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_essays.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _handler = new GradeEssayCommandHandler(_uow.Object, _ai.Object);
    }

    [Fact]
    public async Task Handle_RubricDeletedSinceLinking_ReturnsNotFound()
    {
        _essays.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<EssaySubmission, bool>>>(), default))
            .ReturnsAsync(new EssaySubmission { EssaySubmissionId = _essayId, UserId = _userId, RubricId = _rubricId });
        _rubrics.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<Rubric, bool>>>(), default))
            .ReturnsAsync((Rubric?)null);

        var result = await _handler.Handle(new GradeEssayCommand(_userId, _essayId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
        _ai.Verify(a => a.GradeEssayAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }
}

public class PeerReviewCancelledAndEnrollmentEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _submissions = new();
    private readonly Mock<IEssayPeerReviewRepository> _reviews = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrolments = new();
    private readonly Mock<IRubricRepository> _rubrics = new();

    private readonly Guid _reviewerId = Guid.NewGuid();
    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _submissionId = Guid.NewGuid();
    private readonly Guid _reviewId = Guid.NewGuid();

    public PeerReviewCancelledAndEnrollmentEdgeCaseTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.EssayPeerReviews).Returns(_reviews.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrolments.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
    }

    private EssayPeerReview MakeReview(string status) => new()
    {
        EssayPeerReviewId = _reviewId,
        EssaySubmissionId = _submissionId,
        ReviewerUserId = _reviewerId,
        ClassroomId = _classroomId,
        Status = status,
        AssignedAt = DateTime.UtcNow,
        Submission = new EssaySubmission { EssaySubmissionId = _submissionId, Title = "T", Text = "Body", WordCount = 1 },
    };

    [Fact]
    public async Task Workspace_CancelledReview_ReturnsCancelledError()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview(EssayPeerReviewStatus.Cancelled));
        var handler = new GetPeerReviewWorkspaceQueryHandler(_uow.Object);

        var result = await handler.Handle(new GetPeerReviewWorkspaceQuery(_reviewerId, _reviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("REVIEW_CANCELLED", result.ErrorCode);
    }

    [Fact]
    public async Task Workspace_WithRubric_LoadsCriteria()
    {
        var rubricId = Guid.NewGuid();
        var review = MakeReview(EssayPeerReviewStatus.Assigned);
        review.Submission.RubricId = rubricId;
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(review);
        _enrolments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _reviewerId, default))
            .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _reviewerId });
        _rubrics.Setup(r => r.GetByIdAsync(rubricId, default))
            .ReturnsAsync(new Rubric { RubricId = rubricId, CriteriaJson = """[{"name":"Argument","maxPoints":10}]""" });

        var handler = new GetPeerReviewWorkspaceQueryHandler(_uow.Object);
        var result = await handler.Handle(new GetPeerReviewWorkspaceQuery(_reviewerId, _reviewId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Criteria);
    }

    [Fact]
    public async Task Submit_CancelledReview_ReturnsCancelledError()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview(EssayPeerReviewStatus.Cancelled));
        var handler = new SubmitPeerReviewCommandHandler(_uow.Object);

        var result = await handler.Handle(new SubmitPeerReviewCommand(_reviewerId, _reviewId, Array.Empty<PeerReviewScoreDto>(), "comment"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("REVIEW_CANCELLED", result.ErrorCode);
    }

    [Fact]
    public async Task Submit_ReviewerLeftClassroom_ReturnsNotEnrolled()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview(EssayPeerReviewStatus.Assigned));
        _enrolments.Setup(r => r.GetActiveEnrollmentAsync(_classroomId, _reviewerId, default)).ReturnsAsync((ClassroomEnrollment?)null);
        var handler = new SubmitPeerReviewCommandHandler(_uow.Object);

        var result = await handler.Handle(new SubmitPeerReviewCommand(_reviewerId, _reviewId, Array.Empty<PeerReviewScoreDto>(), "comment"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_ENROLLED", result.ErrorCode);
    }
}

public class PeerReviewScoresParseTests
{
    [Fact]
    public void Parse_MalformedJson_ReturnsEmptyList()
    {
        var result = PeerReviewScores.Parse("{not valid");

        Assert.Empty(result);
    }

    [Fact]
    public void Parse_NullOrWhitespace_ReturnsEmptyList()
    {
        Assert.Empty(PeerReviewScores.Parse(null));
        Assert.Empty(PeerReviewScores.Parse("  "));
    }
}
