namespace StudyPlatform.Domain.Entities;

public class User
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>User's daily study-time goal in minutes, shown on the dashboard. Defaults to 30.</summary>
    public int DailyStudyGoalMinutes { get; set; } = 30;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Course> Courses { get; set; } = new List<Course>();
    public ICollection<OtpCode> OtpCodes { get; set; } = new List<OtpCode>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
