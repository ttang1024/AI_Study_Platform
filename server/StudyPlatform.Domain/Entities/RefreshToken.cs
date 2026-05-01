namespace StudyPlatform.Domain.Entities;

public class RefreshToken
{
    public Guid TokenId { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; }
    public User User { get; set; } = null!;
}
