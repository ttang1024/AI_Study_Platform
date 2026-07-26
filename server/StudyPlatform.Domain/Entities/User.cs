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

    /// <summary>
    /// When the user dismissed the getting-started checklist, or finished it.
    ///
    /// Only the dismissal is stored. Which steps are *done* is derived from their actual library on
    /// every read, so the checklist can never disagree with reality — a stored "uploaded a document"
    /// flag would survive them deleting that document.
    /// </summary>
    public DateTime? OnboardingDismissedAt { get; set; }

    /// <summary>Set when the sample course was seeded, so it is never seeded twice.</summary>
    public DateTime? DemoContentSeededAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<Course> Courses { get; set; } = new List<Course>();
    public ICollection<OtpCode> OtpCodes { get; set; } = new List<OtpCode>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
