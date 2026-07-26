namespace StudyPlatform.Domain.Entities;

public class Quiz
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

    /// <summary>
    /// The document's ContentVersion at the time this was generated. Lower than the document's
    /// current version means the source has since changed and this is stale. Defaults to 1 so rows
    /// written before versioning existed read as current rather than as universally stale.
    /// </summary>
    public int SourceVersion { get; set; } = 1;

    public DateTime CreatedAt { get; set; }
    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
