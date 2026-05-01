namespace StudyPlatform.Domain.Entities;

public class StudyGroup
{
    public Guid StudyGroupId { get; set; }
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string InviteCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public User Owner { get; set; } = null!;
    public ICollection<StudyGroupMember> Members { get; set; } = new List<StudyGroupMember>();
    public ICollection<StudyGroupSharedCourse> SharedCourses { get; set; } = new List<StudyGroupSharedCourse>();
    public ICollection<GroupChatMessage> Messages { get; set; } = new List<GroupChatMessage>();
}
