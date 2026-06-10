namespace StudyPlatform.Domain.Entities;

/// <summary>
/// An exam the user is preparing for. The planner back-plans daily study sessions
/// from the exam date using course mastery and knowledge gaps.
/// </summary>
public class ExamPlan
{
    public Guid ExamPlanId { get; set; }
    public Guid UserId { get; set; }
    public Guid? CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime ExamDate { get; set; }
    public int DailyMinutes { get; set; } = 30;
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Course? Course { get; set; }
}
