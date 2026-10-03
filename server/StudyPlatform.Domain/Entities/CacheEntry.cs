namespace StudyPlatform.Domain.Entities;

public class CacheEntry
{
    public string Key { get; set; } = string.Empty;
    public byte[] Value { get; set; } = [];
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
