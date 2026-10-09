using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Domain.Entities;

public class Quiz : IUserOwned
{
    public Guid QuizId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string OptionsJson { get; set; } = string.Empty;
    public string CorrectAnswer { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "medium";

    /// <summary>
    /// JSON <c>SourceAnchor</c> recording the span of source material this question was generated
    /// from. Null when the supporting quote could not be located in the source.
    /// </summary>
    public string? SourceAnchorJson { get; set; }

    public DateTime CreatedAt { get; set; }
    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
