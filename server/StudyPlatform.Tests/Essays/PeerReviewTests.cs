using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Essays;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Essays;

/// <summary>
/// Peer review hands one user another user's writing, so almost every test here is about the
/// boundary rather than the feature.
/// </summary>
public class PeerReviewTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IEssaySubmissionRepository> _submissions = new();
    private readonly Mock<IEssayPeerReviewRepository> _reviews = new();
    private readonly Mock<IClassroomEnrollmentRepository> _enrolments = new();
    private readonly Mock<IRubricRepository> _rubrics = new();

    private readonly Guid _authorId = Guid.NewGuid();
    private readonly Guid _reviewerId = Guid.NewGuid();
    private readonly Guid _classroomId = Guid.NewGuid();
    private readonly Guid _submissionId = Guid.NewGuid();
    private readonly Guid _reviewId = Guid.NewGuid();

    public PeerReviewTests()
    {
        _uow.Setup(u => u.EssaySubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.EssayPeerReviews).Returns(_reviews.Object);
        _uow.Setup(u => u.ClassroomEnrollments).Returns(_enrolments.Object);
        _uow.Setup(u => u.Rubrics).Returns(_rubrics.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
    }

    private EssaySubmission MakeSubmission() => new()
    {
        EssaySubmissionId = _submissionId,
        UserId = _authorId,
        Title = "On entropy",
        Text = "The full text of the draft.",
        WordCount = 6,
    };

    private EssayPeerReview MakeReview(string status = EssayPeerReviewStatus.Assigned) => new()
    {
        EssayPeerReviewId = _reviewId,
        EssaySubmissionId = _submissionId,
        ReviewerUserId = _reviewerId,
        ClassroomId = _classroomId,
        Status = status,
        AssignedAt = DateTime.UtcNow,
        Submission = MakeSubmission(),
    };

    private void EnrolmentActive(Guid userId) => _enrolments
        .Setup(r => r.GetActiveEnrollmentAsync(_classroomId, userId, default))
        .ReturnsAsync(new ClassroomEnrollment { ClassroomId = _classroomId, UserId = userId });

    private void EnrolmentMissing(Guid userId) => _enrolments
        .Setup(r => r.GetActiveEnrollmentAsync(_classroomId, userId, default))
        .ReturnsAsync((ClassroomEnrollment?)null);

    // ── Requesting reviewers ────────────────────────────────────────────────

    [Fact]
    public async Task Request_AssignsClassmatesButNeverTheAuthor()
    {
        var classmateA = Guid.NewGuid();
        var classmateB = Guid.NewGuid();

        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());
        EnrolmentActive(_authorId);
        _reviews.Setup(r => r.GetExistingReviewerIdsAsync(_submissionId, default))
            .ReturnsAsync(Array.Empty<Guid>());
        _enrolments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _authorId },
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = classmateA },
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = classmateB },
            });

        List<EssayPeerReview>? assigned = null;
        _reviews.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<EssayPeerReview>>(), default))
            .Callback((IEnumerable<EssayPeerReview> rows, CancellationToken _) => assigned = rows.ToList())
            .Returns(Task.CompletedTask);

        var handler = new RequestPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new RequestPeerReviewCommand(_authorId, _submissionId, _classroomId, 2), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, assigned!.Count);
        Assert.DoesNotContain(assigned, r => r.ReviewerUserId == _authorId);
    }

    /// <summary>
    /// Without this the classroom id is a free parameter: anyone could name any classroom and have
    /// its students handed their draft.
    /// </summary>
    [Fact]
    public async Task Request_RefusesAClassroomTheAuthorIsNotIn()
    {
        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());
        EnrolmentMissing(_authorId);

        var handler = new RequestPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new RequestPeerReviewCommand(_authorId, _submissionId, _classroomId, 2), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_ENROLLED", result.ErrorCode);
    }

    [Fact]
    public async Task Request_RefusesADraftTheCallerDoesNotOwn()
    {
        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());

        var handler = new RequestPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new RequestPeerReviewCommand(Guid.NewGuid(), _submissionId, _classroomId, 2), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ESSAY_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Request_DoesNotAskTheSameClassmateTwice()
    {
        var classmate = Guid.NewGuid();

        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());
        EnrolmentActive(_authorId);
        _reviews.Setup(r => r.GetExistingReviewerIdsAsync(_submissionId, default))
            .ReturnsAsync(new[] { classmate });
        _enrolments.Setup(r => r.FindAsNoTrackingAsync(
                It.IsAny<Expression<Func<ClassroomEnrollment, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = _authorId },
                new ClassroomEnrollment { ClassroomId = _classroomId, UserId = classmate },
            });

        var handler = new RequestPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(
            new RequestPeerReviewCommand(_authorId, _submissionId, _classroomId, 2), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_REVIEWERS_AVAILABLE", result.ErrorCode);
    }

    // ── Reading the draft ───────────────────────────────────────────────────

    [Fact]
    public async Task Workspace_GivesAnAssignedReviewerTheDraft()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview());
        EnrolmentActive(_reviewerId);

        var handler = new GetPeerReviewWorkspaceQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetPeerReviewWorkspaceQuery(_reviewerId, _reviewId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("The full text of the draft.", result.Data!.EssayText);
    }

    /// <summary>Holding an assignment is the only thing that grants access to someone else's writing.</summary>
    [Fact]
    public async Task Workspace_RefusesSomeoneWhoWasNotAssigned()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview());

        var handler = new GetPeerReviewWorkspaceQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetPeerReviewWorkspaceQuery(Guid.NewGuid(), _reviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("REVIEW_NOT_FOUND", result.ErrorCode);
    }

    /// <summary>
    /// The assignment row outlives the enrolment, so access has to be re-checked on every open —
    /// otherwise leaving a class keeps the reading rights it came with.
    /// </summary>
    [Fact]
    public async Task Workspace_RefusesAReviewerWhoLeftTheClassroom()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview());
        EnrolmentMissing(_reviewerId);

        var handler = new GetPeerReviewWorkspaceQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetPeerReviewWorkspaceQuery(_reviewerId, _reviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_ENROLLED", result.ErrorCode);
    }

    // ── Submitting ──────────────────────────────────────────────────────────

    /// <summary>Scores come from a client; an unclamped one would let a reviewer award 500%.</summary>
    [Fact]
    public async Task Submit_ClampsScoresToTheRubric()
    {
        var rubricId = Guid.NewGuid();
        var review = MakeReview();
        review.Submission.RubricId = rubricId;

        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(review);
        EnrolmentActive(_reviewerId);
        _rubrics.Setup(r => r.GetByIdAsync(rubricId, default)).ReturnsAsync(new Rubric
        {
            RubricId = rubricId,
            CriteriaJson = """[{"name":"Argument","maxPoints":10}]""",
        });

        var handler = new SubmitPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(new SubmitPeerReviewCommand(
            _reviewerId, _reviewId,
            new[] { new PeerReviewScoreDto("Argument", 999, "Great") },
            "Nice work"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Data!.Scores.Single().Points);
        Assert.Equal(100, result.Data.ScorePercent);
    }

    [Fact]
    public async Task Submit_RefusesAnEmptyReview()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview());
        EnrolmentActive(_reviewerId);

        var handler = new SubmitPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(new SubmitPeerReviewCommand(
            _reviewerId, _reviewId, Array.Empty<PeerReviewScoreDto>(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EMPTY_REVIEW", result.ErrorCode);
    }

    [Fact]
    public async Task Submit_RefusesSomeoneWhoWasNotAssigned()
    {
        _reviews.Setup(r => r.GetWithSubmissionAsync(_reviewId, default)).ReturnsAsync(MakeReview());

        var handler = new SubmitPeerReviewCommandHandler(_uow.Object);
        var result = await handler.Handle(new SubmitPeerReviewCommand(
            Guid.NewGuid(), _reviewId, Array.Empty<PeerReviewScoreDto>(), "sneaky"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("REVIEW_NOT_FOUND", result.ErrorCode);
    }

    // ── Author's view ───────────────────────────────────────────────────────

    /// <summary>Single-blind: the author must never learn which classmate wrote which review.</summary>
    [Fact]
    public async Task AuthorView_NeverNamesTheReviewer()
    {
        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());
        _reviews.Setup(r => r.GetForSubmissionAsync(_submissionId, default))
            .ReturnsAsync(new[] { MakeReview(EssayPeerReviewStatus.Submitted) });

        var handler = new GetPeerReviewsForEssayQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetPeerReviewsForEssayQuery(_authorId, _submissionId), default);

        Assert.True(result.IsSuccess);
        var dto = result.Data!.Single();

        // The DTO has no reviewer field at all — the guarantee is structural, not a matter of
        // remembering to omit it at each call site.
        Assert.DoesNotContain("Reviewer", dto.GetType().GetProperties().Select(p => p.Name));
    }

    [Fact]
    public async Task AuthorView_RefusesAnotherUsersEssay()
    {
        _submissions.Setup(r => r.GetByIdAsync(_submissionId, default)).ReturnsAsync(MakeSubmission());

        var handler = new GetPeerReviewsForEssayQueryHandler(_uow.Object);
        var result = await handler.Handle(
            new GetPeerReviewsForEssayQuery(Guid.NewGuid(), _submissionId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ESSAY_NOT_FOUND", result.ErrorCode);
    }
}
