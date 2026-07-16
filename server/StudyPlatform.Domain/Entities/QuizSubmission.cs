namespace StudyPlatform.Domain.Entities;

public class QuizSubmission
{
    public Guid SubmissionId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    /// <summary>JSON dictionary: { quizId → selectedAnswer }</summary>
    public string AnswersJson { get; set; } = string.Empty;

    /// <summary>
    /// How sure the learner was of each answer, as {quizId: 1|2|3} (1 = guessing, 3 = confident).
    /// Null for submissions made before confidence was captured, and for any the learner skipped —
    /// calibration must therefore treat "no rating" as absent data, not as a low rating.
    /// </summary>
    public string? ConfidenceJson { get; set; }

    public int Score { get; set; }
    public int Total { get; set; }
    public DateTime SubmittedAt { get; set; }

    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
