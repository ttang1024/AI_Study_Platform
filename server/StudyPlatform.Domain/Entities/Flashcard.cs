namespace StudyPlatform.Domain.Entities;

public class Flashcard
{
    public Guid FlashcardId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    public string Front { get; set; } = string.Empty;
    public string Back { get; set; } = string.Empty;
    public string CardType { get; set; } = "basic"; // "basic" | "cloze" | "chart" | "occlusion"
    public string Difficulty { get; set; } = "medium"; // "easy" | "medium" | "hard"
    /// <summary>Image-occlusion cards: source image URL.</summary>
    public string? ImageUrl { get; set; }
    /// <summary>Image-occlusion cards: JSON array of normalized mask rects [{x,y,w,h,label?}].</summary>
    public string? OcclusionsJson { get; set; }
    public string? Chapter { get; set; }
    public List<string> Tags { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
