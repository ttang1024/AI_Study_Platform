namespace StudyPlatform.Domain.Entities;

public class QuizSubmission
{
    public Guid SubmissionId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? YouTubeVideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    /// <summary>JSON dictionary: { quizId → selectedAnswer }</summary>
    public string AnswersJson { get; set; } = string.Empty;
    public int Score { get; set; }
    public int Total { get; set; }
    public DateTime SubmittedAt { get; set; }

    public Document? Document { get; set; }
    public YouTubeVideo? YouTubeVideo { get; set; }
}
