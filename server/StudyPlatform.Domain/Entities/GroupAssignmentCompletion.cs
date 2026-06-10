namespace StudyPlatform.Domain.Entities;

/// <summary>Marks one member's completion of a group assignment.</summary>
public class GroupAssignmentCompletion
{
    public Guid GroupAssignmentCompletionId { get; set; }
    public Guid AssignmentId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CompletedAt { get; set; }

    public GroupAssignment Assignment { get; set; } = null!;
    public User User { get; set; } = null!;
}
