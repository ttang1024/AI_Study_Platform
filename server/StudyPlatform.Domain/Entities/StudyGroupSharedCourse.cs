namespace StudyPlatform.Domain.Entities;

public class StudyGroupSharedCourse
{
    public Guid StudyGroupSharedCourseId { get; set; }
    public Guid GroupId { get; set; }
    public Guid CourseId { get; set; }
    public Guid SharedByUserId { get; set; }
    public DateTime SharedAt { get; set; }
    public StudyGroup Group { get; set; } = null!;
    public Course Course { get; set; } = null!;
    public User SharedBy { get; set; } = null!;
}
