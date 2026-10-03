using StudyPlatform.Application.Documents.DTOs;

namespace StudyPlatform.Application.Services;

/// <summary>Which material a quiz submission belongs to.</summary>
/// <param name="SourceType">"document" or "video" — the discriminator saved on the row.</param>
public readonly record struct QuizSource(string SourceType, Guid? DocumentId = null, Guid? VideoId = null)
{
    public static QuizSource Document(Guid documentId) => new("document", DocumentId: documentId);

    public static QuizSource Video(Guid videoId) => new("video", VideoId: videoId);
}

/// <summary>
/// Records a learner's answers to a quiz: one submission row per material, replaced when they retake
/// it, with the wrong answers folded into the mistakes notebook.
///
/// <para>Document quizzes and video quizzes are the same act on different sources. Writing them in
/// one place is what guarantees a retake cannot leave a stale score behind on one surface and not
/// the other, and that both feed the notebook.</para>
/// </summary>
public interface IQuizSubmissionWriter
{
    Task<QuizSubmissionDto> UpsertAsync(
        Guid userId,
        QuizSource source,
        Dictionary<string, string> answers,
        int score,
        int total,
        Dictionary<string, int>? confidence,
        CancellationToken cancellationToken = default);
}
