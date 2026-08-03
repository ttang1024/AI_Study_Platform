namespace StudyPlatform.Domain.Entities;

/// <summary>
/// One classmate's review of one essay draft.
///
/// <para>The row is created when the review is <em>assigned</em>, not when it is written. That is
/// what makes the reviewer's queue and the author's "2 of 3 back" count possible, and it is also the
/// authorization record: holding an assigned row is the only thing that lets a reviewer read someone
/// else's essay.</para>
/// </summary>
public class EssayPeerReview
{
    public Guid EssayPeerReviewId { get; set; }

    public Guid EssaySubmissionId { get; set; }

    /// <summary>The classmate asked to review. Their identity is never shown to the author.</summary>
    public Guid ReviewerUserId { get; set; }

    /// <summary>
    /// The classroom the pairing was drawn from.
    ///
    /// <para>Recorded so the reviewer's access can be re-checked against a live enrolment: leaving
    /// the class should end the ability to open the draft, and without this there would be nothing
    /// to check against.</para>
    /// </summary>
    public Guid ClassroomId { get; set; }

    /// <summary><see cref="EssayPeerReviewStatus"/>.</summary>
    public string Status { get; set; } = EssayPeerReviewStatus.Assigned;

    /// <summary>JSON array of <c>{ criterionName, points, comment }</c>, mirroring the rubric.</summary>
    public string? ScoresJson { get; set; }

    public string? OverallComment { get; set; }

    /// <summary>Total awarded as a percentage of the rubric, when the rubric had points.</summary>
    public double? ScorePercent { get; set; }

    public DateTime AssignedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public EssaySubmission Submission { get; set; } = null!;
    public User Reviewer { get; set; } = null!;
}

public static class EssayPeerReviewStatus
{
    /// <summary>Assigned and waiting on the reviewer.</summary>
    public const string Assigned = "assigned";

    /// <summary>Written and visible to the author.</summary>
    public const string Submitted = "submitted";

    /// <summary>Withdrawn by the author, or the reviewer left the class. Not shown to either side.</summary>
    public const string Cancelled = "cancelled";
}
