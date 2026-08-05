using System.Text.Json;
using StudyPlatform.Application.Common;
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
        q.QuizId, q.DocumentId, q.VideoId, q.SourceType, q.Question,
        JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
        q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty,
        Citation: ToCitation(q.SourceAnchorJson));

    public static FlashcardDto ToFlashcardDto(this Flashcard f, FlashcardSrsData? srs = null) => new(
        f.FlashcardId, f.DocumentId, f.VideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
        Title: f.Document?.FileName ?? f.Video?.Title,
        Document: f.Document?.FileName,
        Video: f.Video?.Title,
        Srs: srs?.ToSrsDto(),
        CardType: f.CardType,
        Difficulty: f.Difficulty,
        Chapter: f.Chapter,
        Tags: f.Tags,
        ImageUrl: f.ImageUrl,
        OcclusionsJson: f.OcclusionsJson,
        Citation: ToCitation(f.SourceAnchorJson));

    public static FlashcardSrsDto ToSrsDto(this FlashcardSrsData srs) => new(
        srs.FlashcardId, srs.State, srs.Stability, srs.Difficulty, srs.Reps, srs.Lapses,
        srs.Due, srs.LastReview,
        FsrsService.ComputeRetrievability(srs.Stability, srs.LastReview),
        srs.IsSuspended);

    /// <summary>
    /// Basic glossary-term projection (without enriched source metadata such as
    /// course/source name, which the glossary list endpoint computes separately).
    /// </summary>
    public static GlossaryTermDto ToGlossaryTermDto(this GlossaryTerm t) => new(
        t.GlossaryTermId, t.DocumentId, t.Term, t.Definition, t.CreatedAt, t.VideoId,
        Citation: ToCitation(t.SourceAnchorJson));

    /// <summary>
    /// Projects the stored anchor JSON, tolerating rows written before citations existed and any
    /// row whose JSON no longer parses — an unreadable citation degrades to no citation.
    /// </summary>
    private static SourceCitationDto? ToCitation(string? sourceAnchorJson)
    {
        var anchor = SourceAnchorResolver.Deserialize(sourceAnchorJson);
        return anchor == null
            ? null
            : new SourceCitationDto(anchor.Quote, anchor.StartOffset, anchor.EndOffset, anchor.Page, anchor.StartSeconds);
    }

    public static QuizSubmissionDto ToQuizSubmissionDto(this QuizSubmission s) => new(
        s.SubmissionId, s.DocumentId, s.VideoId, s.SourceType,
        JsonSerializer.Deserialize<Dictionary<string, string>>(s.AnswersJson) ?? new(),
        s.Score, s.Total, s.SubmittedAt,
        Title: s.Document?.FileName ?? s.Video?.Title,
        Document: s.Document?.FileName,
        Video: s.Video?.Title,
        CourseId: s.Document?.CourseId ?? s.Video?.CourseId);
}
