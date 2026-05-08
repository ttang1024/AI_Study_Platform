namespace StudyPlatform.Domain.Entities;

public class Quiz
{
    public Guid QuizId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? YouTubeVideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string OptionsJson { get; set; } = string.Empty;
    public string CorrectAnswer { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "medium";
    public DateTime CreatedAt { get; set; }
    public Document? Document { get; set; }
    public YouTubeVideo? YouTubeVideo { get; set; }
}
