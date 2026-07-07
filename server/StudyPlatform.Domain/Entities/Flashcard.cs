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
    public string CardType { get; set; } = "basic"; // "basic" | "cloze" | "chart"
    public string Difficulty { get; set; } = "medium"; // "easy" | "medium" | "hard"
    public string? Chapter { get; set; }
    public List<string> Tags { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
