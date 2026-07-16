using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using System.Text.RegularExpressions;

namespace StudyPlatform.Application.ConceptLinks;

// ── DTOs ────────────────────────────────────────────────────────────────────

/// <summary>
/// A concept that the learner's material touches but hasn't fully closed out:
/// referenced without being mastered, used without a defining source, or bridging
/// multiple courses (a cross-course dependency).
/// </summary>
public record ConceptGapDto(
    string Id,
    string Concept,
    string Reason,
    string Severity,            // "high" | "medium" | "low"
    int ReferenceCount,
    bool Defined,
    bool Mastered,
    IEnumerable<string> CourseIds,
    string? Url);

public record KnowledgeGapStatsDto(int TotalConcepts, int Gaps, int Unmastered, int Undefined, int CrossCourse);

public record KnowledgeGapsDto(IEnumerable<ConceptGapDto> Gaps, KnowledgeGapStatsDto Stats);

// ── Query ───────────────────────────────────────────────────────────────────

public record GetKnowledgeGapsQuery(Guid UserId) : IRequest<Result<KnowledgeGapsDto>>;

public class GetKnowledgeGapsQueryHandler : IRequestHandler<GetKnowledgeGapsQuery, Result<KnowledgeGapsDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetKnowledgeGapsQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    private sealed class ConceptAgg
    {
        public string Id = string.Empty;
        public string Title = string.Empty;
        public readonly HashSet<Guid> TermIds = new();
        public readonly HashSet<string> CourseIds = new(StringComparer.OrdinalIgnoreCase);
        public bool Defined;     // has a glossary source material
        public int References;   // mentions in notes / checks in quizzes
    }

    public async Task<Result<KnowledgeGapsDto>> Handle(GetKnowledgeGapsQuery request, CancellationToken cancellationToken)
    {
        var result = await _cache.GetOrCreateAsync(
            $"concept-links:gaps:user:{request.UserId}",
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.KnowledgeGraphSeconds),
            cancellationToken);
        return Result<KnowledgeGapsDto>.Success(result);
    }

    private async Task<KnowledgeGapsDto> ComputeAsync(Guid userId, CancellationToken cancellationToken)
    {
        var glossaryTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, cancellationToken)).ToList();
        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, cancellationToken)).ToHashSet();
        var notes = (await _unitOfWork.Notes.GetByUserIdAsync(userId, cancellationToken)).ToList();
        var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, cancellationToken)).ToList();
        var documents = (await _unitOfWork.Documents.FindAsNoTrackingAsync(d => d.UserId == userId, cancellationToken)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsNoTrackingAsync(v => v.UserId == userId, cancellationToken)).ToList();

        var docToCourse = documents.ToDictionary(d => d.DocumentId, d => d.CourseId);
        var videoToCourse = videos.ToDictionary(v => v.VideoId, v => v.CourseId);

        string? CourseOf(Guid? docId, Guid? videoId)
        {
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1.ToString();
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2.ToString();
            return null;
        }

        var concepts = new Dictionary<string, ConceptAgg>(StringComparer.OrdinalIgnoreCase);
        var knownConcepts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var term in glossaryTerms)
        {
            var title = CleanTitle(term.Term);
            if (string.IsNullOrWhiteSpace(title)) continue;
            var normalized = NormalizeConcept(title);
            if (string.IsNullOrWhiteSpace(normalized)) normalized = "concept";
            var id = $"concept:{normalized}";

            if (!concepts.TryGetValue(id, out var agg))
            {
                agg = new ConceptAgg { Id = id, Title = title };
                concepts[id] = agg;
            }
            agg.TermIds.Add(term.GlossaryTermId);
            var courseId = CourseOf(term.DocumentId, term.VideoId);
            if (term.DocumentId.HasValue || term.VideoId.HasValue) agg.Defined = true;
            if (courseId != null) agg.CourseIds.Add(courseId);
            knownConcepts[title] = id;
        }

        void CountReferences(string? text, string? courseId)
        {
            foreach (var conceptId in FindConceptsInText(text, knownConcepts))
            {
                if (!concepts.TryGetValue(conceptId, out var agg)) continue;
                agg.References++;
                if (courseId != null) agg.CourseIds.Add(courseId);
            }
        }

        foreach (var note in notes.Take(300))
            CountReferences($"{note.Title} {note.Content}", CourseOf(note.DocumentId, note.VideoId));

        foreach (var quiz in quizzes.Take(600))
            CountReferences($"{quiz.Question} {quiz.Explanation}", CourseOf(quiz.DocumentId, quiz.VideoId));

        var gaps = new List<ConceptGapDto>();
        int unmastered = 0, undefined = 0, crossCourse = 0;

        foreach (var agg in concepts.Values)
        {
            var mastered = agg.TermIds.Any(t => masteredTerms.Contains(t));
            var isCrossCourse = agg.CourseIds.Count >= 2;
            if (!mastered) unmastered++;
            if (!agg.Defined) undefined++;
            if (isCrossCourse) crossCourse++;

            string? reason = null;
            string severity = "low";

            if (!mastered && agg.References >= 3)
            {
                reason = $"Referenced {agg.References} times across your material but not yet mastered.";
                severity = "high";
            }
            else if (isCrossCourse && !mastered)
            {
                reason = $"Bridges {agg.CourseIds.Count} courses but isn't mastered — a likely dependency.";
                severity = "high";
            }
            else if (!mastered && agg.References >= 1)
            {
                reason = $"Comes up in {agg.References} place{(agg.References == 1 ? "" : "s")} but isn't mastered.";
                severity = "medium";
            }
            else if (!agg.Defined && agg.References >= 1)
            {
                reason = "Used in your notes/quizzes without a clear defining source.";
                severity = "medium";
            }
            else if (isCrossCourse)
            {
                reason = $"Shared across {agg.CourseIds.Count} courses.";
                severity = "low";
            }

            if (reason == null) continue;

            gaps.Add(new ConceptGapDto(
                agg.Id, agg.Title, reason, severity, agg.References, agg.Defined, mastered,
                agg.CourseIds.ToArray(), $"/glossary?search={Uri.EscapeDataString(agg.Title)}"));
        }

        var ordered = gaps
            .OrderBy(g => SeverityRank(g.Severity))
            .ThenByDescending(g => g.ReferenceCount)
            .ThenByDescending(g => g.CourseIds.Count())
            .Take(60)
            .ToArray();

        var stats = new KnowledgeGapStatsDto(concepts.Count, ordered.Length, unmastered, undefined, crossCourse);
        return new KnowledgeGapsDto(ordered, stats);
    }

    private static int SeverityRank(string severity) => severity switch { "high" => 0, "medium" => 1, _ => 2 };

    private static IEnumerable<string> FindConceptsInText(string? text, Dictionary<string, string> knownConcepts)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;
        foreach (var concept in knownConcepts)
        {
            if (concept.Key.Length < 3) continue;
            if (text.Contains(concept.Key, StringComparison.OrdinalIgnoreCase))
                yield return concept.Value;
        }
    }

    private static string NormalizeConcept(string term)
        => Regex.Replace(term.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

    private static string CleanTitle(string text)
        => Truncate(Regex.Replace(text, @"\s+", " ").Trim().Trim('-', '*', '#'), 80);

    private static string Truncate(string text, int maxLength)
        => text.Length <= maxLength ? text : text[..maxLength].TrimEnd() + "...";
}
