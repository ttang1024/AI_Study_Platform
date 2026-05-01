namespace StudyPlatform.Domain.Entities;

public class StudyGroupMember
{
    public Guid StudyGroupMemberId { get; set; }
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "member"; // "owner" | "member"
    public DateTime JoinedAt { get; set; }
    public StudyGroup Group { get; set; } = null!;
    public User User { get; set; } = null!;
}
