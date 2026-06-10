using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Mistakes;

/// <summary>
/// Upserts mistake-notebook entries from a quiz submission. Wrong answers create or bump an
/// entry; correct answers resolve a previously-open entry for the same question. Callers are
/// responsible for SaveChangesAsync (this runs inside the submission handlers' unit of work).
/// </summary>
public static class MistakeCapture
{
    public static async Task CaptureAsync(
        IUnitOfWork unitOfWork,
        Guid userId,
        string sourceType,
        Guid? documentId,
        Guid? videoId,
        IReadOnlyDictionary<string, string> answers,
        CancellationToken cancellationToken)
    {
        var quizzes = sourceType == "video"
            ? await unitOfWork.Quizzes.FindAsync(q => q.UserId == userId && q.YouTubeVideoId == videoId, cancellationToken)
            : await unitOfWork.Quizzes.FindAsync(q => q.UserId == userId && q.DocumentId == documentId, cancellationToken);

        await CaptureForQuizzesAsync(unitOfWork, userId, quizzes.ToList(), answers, cancellationToken);
    }

    /// <summary>
    /// Same upsert logic for an arbitrary set of the user's quizzes (e.g. a mock exam, or the
    /// one-time backfill replaying old submissions). <paramref name="occurredAt"/> overrides the
    /// missed/resolved timestamps so backfilled entries keep their original submission date.
    /// </summary>
    public static async Task CaptureForQuizzesAsync(
        IUnitOfWork unitOfWork,
        Guid userId,
        IReadOnlyList<Quiz> quizzes,
        IReadOnlyDictionary<string, string> answers,
        CancellationToken cancellationToken,
        DateTime? occurredAt = null)
    {
        // Answer keys are quiz ids serialized by the client; tolerate GUID casing differences.
        var quizById = quizzes.ToDictionary(q => q.QuizId.ToString(), q => q, StringComparer.OrdinalIgnoreCase);
        if (quizById.Count == 0) return;

        var quizIds = quizzes.Select(q => (Guid?)q.QuizId).ToList();
        var existingEntries = await unitOfWork.MistakeEntries.FindAsync(
            m => m.UserId == userId && m.QuizId != null && quizIds.Contains(m.QuizId), cancellationToken);
        var entryByQuizId = existingEntries
            .Where(m => m.QuizId.HasValue)
            .GroupBy(m => m.QuizId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var now = occurredAt ?? DateTime.UtcNow;

        foreach (var (quizIdKey, selectedAnswer) in answers)
        {
            if (!quizById.TryGetValue(quizIdKey, out var quiz)) continue;

            var isCorrect = QuizAnswerComparer.IsCorrect(selectedAnswer, quiz.CorrectAnswer);
            entryByQuizId.TryGetValue(quiz.QuizId, out var entry);

            if (isCorrect)
            {
                // Answering it right closes the loop on a previously-missed question.
                if (entry != null && entry.Status == "open")
                {
                    entry.Status = "resolved";
                    entry.ResolvedAt = now;
                    unitOfWork.MistakeEntries.Update(entry);
                }
                continue;
            }

            if (entry != null)
            {
                entry.TimesMissed++;
                entry.LastMissedAt = now;
                entry.UserAnswer = selectedAnswer;
                entry.Status = "open";
                entry.ResolvedAt = null;
                unitOfWork.MistakeEntries.Update(entry);
            }
            else
            {
                await unitOfWork.MistakeEntries.AddAsync(new MistakeEntry
                {
                    MistakeEntryId = Guid.NewGuid(),
                    UserId = userId,
                    QuizId = quiz.QuizId,
                    DocumentId = quiz.DocumentId,
                    YouTubeVideoId = quiz.YouTubeVideoId,
                    SourceType = quiz.SourceType,
                    Question = quiz.Question,
                    OptionsJson = quiz.OptionsJson,
                    CorrectAnswer = quiz.CorrectAnswer,
                    UserAnswer = selectedAnswer,
                    Explanation = quiz.Explanation,
                    Status = "open",
                    TimesMissed = 1,
                    FirstMissedAt = now,
                    LastMissedAt = now,
                }, cancellationToken);
            }
        }
    }
}
