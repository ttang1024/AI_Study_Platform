using StudyPlatform.Domain.Enums;

namespace StudyPlatform.Domain.Entities;

public class OtpCode
{
    public Guid OtpId { get; set; }
    public Guid? UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public OtpPurpose Purpose { get; set; }
    public bool IsUsed { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public User? User { get; set; }
}
