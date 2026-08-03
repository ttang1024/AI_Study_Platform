using System.Security.Cryptography;
using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Essays;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record PeerReviewScoreDto(string CriterionName, double Points, string? Comment);

/// <summary>
/// A review as its author sees it. The reviewer is not named: peer review is single-blind here, so
/// feedback is read on its merits and classmates are not put in the position of grading a friend
/// under their own name.
/// </summary>
public record PeerReviewDto(
    Guid EssayPeerReviewId,
    string Status,
    IReadOnlyList<PeerReviewScoreDto> Scores,
    string? OverallComment,
    double? ScorePercent,
    DateTime AssignedAt,
    DateTime? SubmittedAt);

/// <summary>An entry in a reviewer's queue, carrying enough of the draft to open it.</summary>
public record PeerReviewAssignmentDto(
    Guid EssayPeerReviewId,
    Guid EssaySubmissionId,
    string EssayTitle,
    string? PromptText,
    int WordCount,
    string Status,
    DateTime AssignedAt,
    DateTime? SubmittedAt);

/// <summary>The full draft plus its rubric — returned only to an assigned reviewer.</summary>
public record PeerReviewWorkspaceDto(
    Guid EssayPeerReviewId,
    Guid EssaySubmissionId,
    string EssayTitle,
    string? PromptText,
    string EssayText,
    int WordCount,
    IReadOnlyList<RubricCriterionDto> Criteria,
    string Status,
    IReadOnlyList<PeerReviewScoreDto> ExistingScores,
    string? ExistingComment);

public record RequestPeerReviewRequest(Guid ClassroomId, int ReviewerCount);

public record SubmitPeerReviewRequest(IReadOnlyList<PeerReviewScoreDto> Scores, string? OverallComment);

// ── Request reviewers ───────────────────────────────────────────────────────

/// <summary>
/// Asks classmates to review a draft. Reviewers are drawn at random from the classroom's active
/// students, excluding the author and anyone already assigned.
/// </summary>
public record RequestPeerReviewCommand(Guid UserId, Guid EssaySubmissionId, Guid ClassroomId, int ReviewerCount)
    : IRequest<Result<int>>;

public class RequestPeerReviewCommandHandler : IRequestHandler<RequestPeerReviewCommand, Result<int>>
{
    /// <summary>
    /// More than three reviewers per draft turns a class into a queue of homework about homework,
    /// and the marginal feedback after the third is small.
    /// </summary>
    private const int MaxReviewersPerRequest = 3;

    private readonly IUnitOfWork _unitOfWork;

    public RequestPeerReviewCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<int>> Handle(RequestPeerReviewCommand request, CancellationToken cancellationToken)
    {
        var submission = await _unitOfWork.EssaySubmissions.GetByIdAsync(request.EssaySubmissionId, cancellationToken);
        if (submission == null || submission.UserId != request.UserId)
            return Result<int>.Failure("Essay not found.", "ESSAY_NOT_FOUND");

        var count = Math.Clamp(request.ReviewerCount, 1, MaxReviewersPerRequest);

        // The author must be in the classroom they are asking for reviewers from. Without this check
        // any user could name any classroom id and have its students handed their draft.
        var authorEnrolment = await _unitOfWork.ClassroomEnrollments.GetActiveEnrollmentAsync(
            request.ClassroomId, request.UserId, cancellationToken);

        if (authorEnrolment == null)
            return Result<int>.Failure("You're not in that classroom.", "NOT_ENROLLED");

        var alreadyAsked = (await _unitOfWork.EssayPeerReviews.GetExistingReviewerIdsAsync(
            request.EssaySubmissionId, cancellationToken)).ToHashSet();

        var classmates = (await _unitOfWork.ClassroomEnrollments.FindAsNoTrackingAsync(
                e => e.ClassroomId == request.ClassroomId && e.RemovedAt == null, cancellationToken))
            .Select(e => e.UserId)
            .Where(id => id != request.UserId && !alreadyAsked.Contains(id))
            .Distinct()
            .ToList();

        if (classmates.Count == 0)
            return Result<int>.Failure(
                alreadyAsked.Count > 0
                    ? "Everyone else in this classroom has already been asked."
                    : "There's nobody else in this classroom yet.",
                "NO_REVIEWERS_AVAILABLE");

        // Shuffled with a cryptographic shuffle rather than sorted by anything: any stable ordering
        // (enrolment date, id) would send every draft in the class to the same one or two people.
        Shuffle(classmates);

        var now = DateTime.UtcNow;
        var assigned = classmates.Take(count).Select(reviewerId => new EssayPeerReview
        {
            EssayPeerReviewId = Guid.NewGuid(),
            EssaySubmissionId = request.EssaySubmissionId,
            ReviewerUserId = reviewerId,
            ClassroomId = request.ClassroomId,
            Status = EssayPeerReviewStatus.Assigned,
            AssignedAt = now,
        }).ToList();

        await _unitOfWork.EssayPeerReviews.AddRangeAsync(assigned, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<int>.Success(assigned.Count,
            assigned.Count == 1
                ? "Asked 1 classmate to review your draft."
                : $"Asked {assigned.Count} classmates to review your draft.");
    }

    private static void Shuffle(List<Guid> items)
    {
        for (var i = items.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
}

// ── Reviewer's queue and workspace ──────────────────────────────────────────

public record GetMyPeerReviewsQuery(Guid UserId, bool IncludeSubmitted)
    : IRequest<Result<IReadOnlyList<PeerReviewAssignmentDto>>>;

public class GetMyPeerReviewsQueryHandler
    : IRequestHandler<GetMyPeerReviewsQuery, Result<IReadOnlyList<PeerReviewAssignmentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetMyPeerReviewsQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<IReadOnlyList<PeerReviewAssignmentDto>>> Handle(
        GetMyPeerReviewsQuery request, CancellationToken cancellationToken)
    {
        var reviews = await _unitOfWork.EssayPeerReviews.GetAssignedToReviewerAsync(
            request.UserId, request.IncludeSubmitted, cancellationToken);

        // Title and word count only. The queue lists drafts the reviewer has not opened yet, and the
        // text itself belongs to the workspace, behind its own authorization check.
        IReadOnlyList<PeerReviewAssignmentDto> dtos = reviews
            .Select(r => new PeerReviewAssignmentDto(
                r.EssayPeerReviewId,
                r.EssaySubmissionId,
                r.Submission.Title,
                r.Submission.PromptText,
                r.Submission.WordCount,
                r.Status,
                r.AssignedAt,
                r.SubmittedAt))
            .ToList();

        return Result<IReadOnlyList<PeerReviewAssignmentDto>>.Success(dtos);
    }
}

/// <summary>Opens a draft for review. This is the only path by which one user reads another's essay.</summary>
public record GetPeerReviewWorkspaceQuery(Guid UserId, Guid EssayPeerReviewId)
    : IRequest<Result<PeerReviewWorkspaceDto>>;

public class GetPeerReviewWorkspaceQueryHandler
    : IRequestHandler<GetPeerReviewWorkspaceQuery, Result<PeerReviewWorkspaceDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPeerReviewWorkspaceQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PeerReviewWorkspaceDto>> Handle(
        GetPeerReviewWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var review = await _unitOfWork.EssayPeerReviews.GetWithSubmissionAsync(
            request.EssayPeerReviewId, cancellationToken);

        if (review == null || review.ReviewerUserId != request.UserId)
            return Result<PeerReviewWorkspaceDto>.Failure("Review not found.", "REVIEW_NOT_FOUND");

        if (review.Status == EssayPeerReviewStatus.Cancelled)
            return Result<PeerReviewWorkspaceDto>.Failure(
                "This review was withdrawn by the author.", "REVIEW_CANCELLED");

        // Enrolment is re-checked on every open, not just at assignment. A reviewer who has left the
        // class keeps their assignment row, and without this they would keep the reading rights that
        // came with it.
        var enrolment = await _unitOfWork.ClassroomEnrollments.GetActiveEnrollmentAsync(
            review.ClassroomId, request.UserId, cancellationToken);

        if (enrolment == null)
            return Result<PeerReviewWorkspaceDto>.Failure(
                "You're no longer in the classroom this review came from.", "NOT_ENROLLED");

        var criteria = new List<RubricCriterionDto>();
        if (review.Submission.RubricId is { } rubricId)
        {
            var rubric = await _unitOfWork.Rubrics.GetByIdAsync(rubricId, cancellationToken);
            if (rubric != null)
                criteria = EssayMappings.ParseCriteria(rubric.CriteriaJson);
        }

        return Result<PeerReviewWorkspaceDto>.Success(new PeerReviewWorkspaceDto(
            review.EssayPeerReviewId,
            review.EssaySubmissionId,
            review.Submission.Title,
            review.Submission.PromptText,
            review.Submission.Text,
            review.Submission.WordCount,
            criteria,
            review.Status,
            PeerReviewScores.Parse(review.ScoresJson),
            review.OverallComment));
    }
}

// ── Submit ──────────────────────────────────────────────────────────────────

public record SubmitPeerReviewCommand(
    Guid UserId, Guid EssayPeerReviewId, IReadOnlyList<PeerReviewScoreDto> Scores, string? OverallComment)
    : IRequest<Result<PeerReviewDto>>;

public class SubmitPeerReviewCommandHandler : IRequestHandler<SubmitPeerReviewCommand, Result<PeerReviewDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SubmitPeerReviewCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<PeerReviewDto>> Handle(
        SubmitPeerReviewCommand request, CancellationToken cancellationToken)
    {
        var review = await _unitOfWork.EssayPeerReviews.GetWithSubmissionAsync(
            request.EssayPeerReviewId, cancellationToken);

        if (review == null || review.ReviewerUserId != request.UserId)
            return Result<PeerReviewDto>.Failure("Review not found.", "REVIEW_NOT_FOUND");

        if (review.Status == EssayPeerReviewStatus.Cancelled)
            return Result<PeerReviewDto>.Failure("This review was withdrawn.", "REVIEW_CANCELLED");

        var enrolment = await _unitOfWork.ClassroomEnrollments.GetActiveEnrollmentAsync(
            review.ClassroomId, request.UserId, cancellationToken);

        if (enrolment == null)
            return Result<PeerReviewDto>.Failure(
                "You're no longer in that classroom.", "NOT_ENROLLED");

        if (string.IsNullOrWhiteSpace(request.OverallComment) && request.Scores.Count == 0)
            return Result<PeerReviewDto>.Failure(
                "Add a comment or score at least one criterion.", "EMPTY_REVIEW");

        var criteria = new List<RubricCriterionDto>();
        if (review.Submission.RubricId is { } rubricId)
        {
            var rubric = await _unitOfWork.Rubrics.GetByIdAsync(rubricId, cancellationToken);
            if (rubric != null)
                criteria = EssayMappings.ParseCriteria(rubric.CriteriaJson);
        }

        // Clamped to the rubric rather than trusted. The scores arrive from a client, and an
        // unclamped value would let one reviewer award 500% and skew the author's average.
        var clamped = request.Scores
            .Select(s =>
            {
                var criterion = criteria.FirstOrDefault(c =>
                    string.Equals(c.Name, s.CriterionName, StringComparison.OrdinalIgnoreCase));
                var max = criterion?.MaxPoints ?? s.Points;
                return new PeerReviewScoreDto(s.CriterionName, Math.Clamp(s.Points, 0, Math.Max(max, 0)), s.Comment);
            })
            .ToList();

        var totalPossible = criteria.Sum(c => c.MaxPoints);

        review.ScoresJson = JsonSerializer.Serialize(clamped);
        review.OverallComment = request.OverallComment;
        review.ScorePercent = totalPossible > 0
            ? Math.Round(clamped.Sum(s => s.Points) / totalPossible * 100, 1)
            : null;
        review.Status = EssayPeerReviewStatus.Submitted;
        review.SubmittedAt = DateTime.UtcNow;

        _unitOfWork.EssayPeerReviews.Update(review);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<PeerReviewDto>.Success(PeerReviewScores.ToDto(review), "Review sent.");
    }
}

// ── Author's view ───────────────────────────────────────────────────────────

public record GetPeerReviewsForEssayQuery(Guid UserId, Guid EssaySubmissionId)
    : IRequest<Result<IReadOnlyList<PeerReviewDto>>>;

public class GetPeerReviewsForEssayQueryHandler
    : IRequestHandler<GetPeerReviewsForEssayQuery, Result<IReadOnlyList<PeerReviewDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetPeerReviewsForEssayQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<IReadOnlyList<PeerReviewDto>>> Handle(
        GetPeerReviewsForEssayQuery request, CancellationToken cancellationToken)
    {
        var submission = await _unitOfWork.EssaySubmissions.GetByIdAsync(request.EssaySubmissionId, cancellationToken);
        if (submission == null || submission.UserId != request.UserId)
            return Result<IReadOnlyList<PeerReviewDto>>.Failure("Essay not found.", "ESSAY_NOT_FOUND");

        var reviews = await _unitOfWork.EssayPeerReviews.GetForSubmissionAsync(
            request.EssaySubmissionId, cancellationToken);

        // Pending assignments are included so the author can see "2 of 3 back" — but they carry no
        // scores, and no row ever carries the reviewer's identity.
        IReadOnlyList<PeerReviewDto> dtos = reviews
            .Where(r => r.Status != EssayPeerReviewStatus.Cancelled)
            .Select(PeerReviewScores.ToDto)
            .ToList();

        return Result<IReadOnlyList<PeerReviewDto>>.Success(dtos);
    }
}

// ── Shared mapping ──────────────────────────────────────────────────────────

internal static class PeerReviewScores
{
    public static List<PeerReviewScoreDto> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<PeerReviewScoreDto>();

        try
        {
            return JsonSerializer.Deserialize<List<PeerReviewScoreDto>>(
                json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }
        catch (JsonException)
        {
            // Same posture as the rubric parser: an unreadable review renders empty rather than
            // taking down the page that lists it.
            return new List<PeerReviewScoreDto>();
        }
    }

    public static PeerReviewDto ToDto(EssayPeerReview r) => new(
        r.EssayPeerReviewId,
        r.Status,
        Parse(r.ScoresJson),
        r.OverallComment,
        r.ScorePercent,
        r.AssignedAt,
        r.SubmittedAt);
}
