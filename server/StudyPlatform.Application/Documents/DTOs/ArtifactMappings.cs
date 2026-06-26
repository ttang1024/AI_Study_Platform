using System.Text.Json;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Documents.DTOs;

/// <summary>
/// Shared entity → DTO projections for generated study artifacts (quizzes and flashcards).
/// Used by both the document and YouTube-video endpoints so the mapping lives in one place.
/// </summary>
public static class ArtifactMappings
{
    public static QuizDto ToQuizDto(this Quiz q) => new(
        q.QuizId, q.DocumentId, q.YouTubeVideoId, q.SourceType, q.Question,
        JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
        q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty);

    public static FlashcardDto ToFlashcardDto(this Flashcard f, FlashcardSrsData? srs = null) => new(
        f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
        Title: f.Document?.FileName ?? f.YouTubeVideo?.Title,
        Document: f.Document?.FileName,
        Video: f.YouTubeVideo?.Title,
        Srs: srs?.ToSrsDto(),
        CardType: f.CardType,
        Difficulty: f.Difficulty,
        Chapter: f.Chapter,
        Tags: f.Tags);

    public static FlashcardSrsDto ToSrsDto(this FlashcardSrsData srs) => new(
        srs.FlashcardId, srs.State, srs.Stability, srs.Difficulty, srs.Reps, srs.Lapses,
        srs.Due, srs.LastReview,
        FsrsService.ComputeRetrievability(srs.Stability, srs.LastReview));

    /// <summary>
    /// Basic glossary-term projection (without enriched source metadata such as
    /// course/source name, which the glossary list endpoint computes separately).
    /// </summary>
    public static GlossaryTermDto ToGlossaryTermDto(this GlossaryTerm t) => new(
        t.GlossaryTermId, t.DocumentId, t.Term, t.Definition, t.CreatedAt, t.YouTubeVideoId);

    public static QuizSubmissionDto ToQuizSubmissionDto(this QuizSubmission s) => new(
        s.SubmissionId, s.DocumentId, s.YouTubeVideoId, s.SourceType,
        JsonSerializer.Deserialize<Dictionary<string, string>>(s.AnswersJson) ?? new(),
        s.Score, s.Total, s.SubmittedAt,
        Title: s.Document?.FileName ?? s.YouTubeVideo?.Title,
        Document: s.Document?.FileName,
        Video: s.YouTubeVideo?.Title);
}
