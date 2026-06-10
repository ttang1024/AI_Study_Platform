namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A task the group owner (teacher) posts to a study group — e.g. "read chapter 3",
/// optionally linking to a material or quiz. Members check it off; completions are
/// tracked per member for the group's progress view.
/// </summary>
public class GroupAssignment
{
    public Guid GroupAssignmentId { get; set; }
    public Guid GroupId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>Optional in-app link, e.g. "/documents/{id}" or "/quizzes".</summary>
    public string? LinkUrl { get; set; }
    public DateTime? DueAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public StudyGroup Group { get; set; } = null!;
    public ICollection<GroupAssignmentCompletion> Completions { get; set; } = new List<GroupAssignmentCompletion>();
}
