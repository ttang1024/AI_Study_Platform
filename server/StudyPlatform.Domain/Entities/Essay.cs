namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A marking scheme: named criteria, each worth some points.
///
/// Criteria are stored as JSON rather than as rows. They are always read and written as a whole
/// scheme, never queried across, and a rubric is edited by replacing it — a criteria table would add
/// a join and a migration surface for no query anyone makes.
/// </summary>
public class Rubric
{
    public Guid RubricId { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>JSON array of <c>{ name, description, maxPoints }</c>.</summary>
    public string CriteriaJson { get; set; } = "[]";

    /// <summary>Set when this rubric is shared with a classroom rather than personal.</summary>
    public Guid? ClassroomId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}

/// <summary>
/// One draft of a piece of writing, and the feedback on it.
///
/// Revisions are separate rows chained by <see cref="ParentSubmissionId"/> rather than an edited
/// row, because the whole value of rubric feedback is seeing a draft improve against the same
/// criteria — overwriting would destroy exactly the comparison the feature exists to show.
/// </summary>
public class EssaySubmission
{
    public Guid EssaySubmissionId { get; set; }
    public Guid UserId { get; set; }
    public Guid? RubricId { get; set; }

    /// <summary>Source material the essay responds to, when it came from the library.</summary>
    public Guid? DocumentId { get; set; }

    public string Title { get; set; } = string.Empty;

    /// <summary>The question or task being answered. Graded against, so it is kept with the draft.</summary>
    public string? PromptText { get; set; }

    public string Text { get; set; } = string.Empty;
    public int WordCount { get; set; }

    /// <summary>1 for the first draft, incrementing along the revision chain.</summary>
    public int Version { get; set; } = 1;

    /// <summary>The draft this one revises. Null for a first draft.</summary>
    public Guid? ParentSubmissionId { get; set; }

    /// <summary>JSON <c>{ overallComment, strengths[], improvements[], criteria[] }</c>. Null until graded.</summary>
    public string? FeedbackJson { get; set; }

    public double? ScorePercent { get; set; }
    public DateTime? GradedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public Rubric? Rubric { get; set; }
}
