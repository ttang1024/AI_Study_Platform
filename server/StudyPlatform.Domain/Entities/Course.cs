namespace StudyPlatform.Domain.Entities;

public class Course
{
    public Guid CourseId { get; set; }
    public Guid UserId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string CourseColor { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public ICollection<Document> Documents { get; set; } = new List<Document>();
}
