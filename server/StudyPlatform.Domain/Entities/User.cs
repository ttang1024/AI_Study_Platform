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

    /// <summary>
    /// When the one-time replay of pre-notebook quiz submissions into the mistake notebook ran.
    /// Null means it still needs to run; it is stamped even when the replay finds nothing, so an
    /// empty notebook doesn't re-trigger a full history scan on every open.
    /// </summary>
    public DateTime? MistakesBackfilledAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Course> Courses { get; set; } = new List<Course>();
    public ICollection<OtpCode> OtpCodes { get; set; } = new List<OtpCode>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
