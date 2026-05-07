namespace StudyPlatform.Domain.Entities;

public class YouTubeVideo
{
    public Guid YouTubeVideoId { get; set; }
    public Guid UserId { get; set; }
    public Guid CourseId { get; set; }
    public string VideoId { get; set; } = string.Empty;   // YouTube video ID (e.g. dQw4w9WgXcQ)
    public string VideoUrl { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? MindMapText { get; set; }
    public string? Transcript { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public Course Course { get; set; } = null!;
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
