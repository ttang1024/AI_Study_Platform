using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Search.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record LibraryCitationDto(int Index, string Type, string Id, string Title, string? Url);

public record AskLibraryDto(string Answer, IReadOnlyList<LibraryCitationDto> Citations);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// "Ask my whole library": retrieves the passages most relevant to the question, then asks the AI to
/// answer grounded in those excerpts with [n] citations linking back to the source.
///
/// Retrieval is semantic when embeddings are configured. That matters more here than anywhere else in
/// the app: keyword retrieval hands the model whichever sources happen to share vocabulary with the
/// question, so a question phrased differently from the material retrieves the wrong passages and the
/// model then answers confidently from them. The keyword scorer below stays as the fallback.
/// </summary>
public record AskLibraryQuery(Guid UserId, string Question) : IRequest<Result<AskLibraryDto>>;

public class AskLibraryQueryHandler : IRequestHandler<AskLibraryQuery, Result<AskLibraryDto>>
{
    private const int MaxSources = 6;
    private const int MaxExcerptChars = 1600;

    /// <summary>Chunks to pull before collapsing them down to MaxSources distinct citations.</summary>
    private const int SemanticFetch = 24;

    /// <summary>Beyond this cosine distance a passage isn't about the question; feeding it to the model invites invention.</summary>
    private const double MaxSemanticDistance = 0.6;

    private static readonly string[] SemanticSourceTypes = ["document", "video", "note", "glossary"];

    private static readonly HashSet<string> Stopwords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "for", "are", "was", "what", "when", "where", "which", "who", "why", "how",
        "does", "did", "can", "could", "would", "should", "this", "that", "with", "from", "into",
        "about", "between", "explain", "their", "there", "have", "has", "had", "you", "your",
    };

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IEmbeddingIndex _embeddingIndex;
    private readonly ILogger<AskLibraryQueryHandler> _logger;

    public AskLibraryQueryHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IEmbeddingIndex embeddingIndex,
        ILogger<AskLibraryQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _embeddingIndex = embeddingIndex;
        _logger = logger;
    }

    private sealed record Source(string Type, string Id, string Title, string Excerpt, string? Url);

    public async Task<Result<AskLibraryDto>> Handle(AskLibraryQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
            return Result<AskLibraryDto>.Failure("Question is required.", "QUESTION_REQUIRED");

        var sources = await RetrieveSemanticAsync(request.UserId, request.Question, cancellationToken);
        if (sources.Count == 0)
            sources = await RetrieveByKeywordAsync(request.UserId, request.Question, cancellationToken);

        if (sources.Count == 0)
            return Result<AskLibraryDto>.Failure("Nothing in your library matches that question yet.", "NO_SOURCES");

        var citations = new List<LibraryCitationDto>();
        var contextParts = new List<string>();
        for (var i = 0; i < sources.Count; i++)
        {
            var s = sources[i];
            citations.Add(new LibraryCitationDto(i + 1, s.Type, s.Id, s.Title, s.Url));
            contextParts.Add($"[{i + 1}] ({s.Type}: {s.Title})\n{s.Excerpt}");
        }

        var context =
            "You are answering a question using ONLY the user's own study library excerpts below. " +
            "Cite sources inline with their bracketed number, e.g. [1] or [2], wherever you use them. " +
            "If the excerpts don't contain the answer, say so honestly.\n\n" +
            string.Join("\n\n---\n\n", contextParts);

        var answer = await _aiService.AnswerQuestionAsync(context, request.Question, cancellationToken);

        return Result<AskLibraryDto>.Success(new AskLibraryDto(answer, citations));
    }

    // ── Semantic retrieval ────────────────────────────────────────────────────

    private async Task<List<Source>> RetrieveSemanticAsync(Guid userId, string question, CancellationToken cancellationToken)
    {
        try
        {
            var hits = await _embeddingIndex.SearchAsync(
                userId, question, SemanticSourceTypes, SemanticFetch, cancellationToken);

            return hits
                .Where(h => h.Distance <= MaxSemanticDistance)
                // Several chunks of one document can all be relevant, but citing the same document six
                // times crowds out every other source. Keep each source's single best passage.
                .GroupBy(h => (h.SourceType, h.SourceId))
                .Select(g => g.OrderBy(h => h.Distance).First())
                .OrderBy(h => h.Distance)
                .Take(MaxSources)
                .Select(h => new Source(
                    h.SourceType,
                    h.SourceId.ToString(),
                    h.Title,
                    // The chunk is already the relevant passage — no keyword window needed.
                    h.Text.Length <= MaxExcerptChars ? h.Text : h.Text[..MaxExcerptChars],
                    UrlFor(h.SourceType, h.SourceId, h.Title)))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Semantic retrieval failed; falling back to keyword retrieval");
            return [];
        }
    }

    private static string? UrlFor(string sourceType, Guid sourceId, string title) => sourceType switch
    {
        "document" => $"/documents/{sourceId}",
        "video" => $"/videos/{sourceId}",
        "note" => "/notes",
        "glossary" => $"/glossary?search={Uri.EscapeDataString(title)}",
        _ => null,
    };

    // ── Keyword retrieval (fallback when embeddings are unconfigured) ─────────

    private async Task<List<Source>> RetrieveByKeywordAsync(Guid userId, string question, CancellationToken cancellationToken)
    {
        var keywords = question
            .Split(' ', '\t', '\n', ',', '.', '?', '!', ';', ':', '(', ')', '"', '\'')
            .Where(w => w.Length >= 3 && !Stopwords.Contains(w))
            .Select(w => w.ToLowerInvariant())
            .Distinct()
            .ToList();
        if (keywords.Count == 0)
            keywords = [question.Trim().ToLowerInvariant()];

        var documents = (await _unitOfWork.Documents.FindAsNoTrackingAsync(d => d.UserId == userId, cancellationToken)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsNoTrackingAsync(v => v.UserId == userId, cancellationToken)).ToList();
        var notes = (await _unitOfWork.Notes.GetByUserIdAsync(userId, cancellationToken)).ToList();
        var terms = (await _unitOfWork.GlossaryTerms.FindAsNoTrackingAsync(t => t.UserId == userId, cancellationToken)).ToList();

        var candidates = new List<(Source Source, double Score)>();

        foreach (var d in documents)
        {
            var body = d.Summary ?? d.Transcript ?? string.Empty;
            var score = Score(keywords, d.FileName, body);
            if (score > 0)
                candidates.Add((new Source("document", d.DocumentId.ToString(), d.FileName, Excerpt(body, keywords), $"/documents/{d.DocumentId}"), score));
        }

        foreach (var v in videos)
        {
            var body = v.Summary ?? v.Transcript ?? string.Empty;
            var score = Score(keywords, v.Title, body);
            if (score > 0)
                candidates.Add((new Source("video", v.VideoId.ToString(), v.Title, Excerpt(body, keywords), $"/videos/{v.VideoId}"), score));
        }

        foreach (var n in notes)
        {
            var title = string.IsNullOrWhiteSpace(n.Title) ? "Note" : n.Title;
            var score = Score(keywords, title, n.Content);
            if (score > 0)
                candidates.Add((new Source("note", n.NoteId.ToString(), title!, Excerpt(n.Content, keywords), "/notes"), score));
        }

        foreach (var t in terms)
        {
            var score = Score(keywords, t.Term, t.Definition) * 1.5; // definitions are dense, boost them
            if (score > 0)
                candidates.Add((new Source("glossary", t.GlossaryTermId.ToString(), t.Term, Excerpt(t.Definition, keywords),
                    $"/glossary?search={Uri.EscapeDataString(t.Term)}"), score));
        }

        return candidates
            .OrderByDescending(c => c.Score)
            .Take(MaxSources)
            .Select(c => c.Source)
            .ToList();
    }

    private static double Score(IReadOnlyList<string> keywords, string title, string body)
    {
        if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(body)) return 0;
        var titleLower = title.ToLowerInvariant();
        var bodyLower = body.Length > 20000 ? body[..20000].ToLowerInvariant() : body.ToLowerInvariant();

        double score = 0;
        foreach (var kw in keywords)
        {
            if (titleLower.Contains(kw)) score += 5;
            var idx = 0;
            var hits = 0;
            while (hits < 10 && (idx = bodyLower.IndexOf(kw, idx, StringComparison.Ordinal)) >= 0)
            {
                hits++;
                idx += kw.Length;
            }
            score += hits;
        }
        return score;
    }

    /// <summary>Take text around the first keyword hit so the excerpt is on-topic, not just the intro.</summary>
    private static string Excerpt(string text, IReadOnlyList<string> keywords)
    {
        if (text.Length <= MaxExcerptChars) return text;

        var lower = text.ToLowerInvariant();
        var firstHit = keywords
            .Select(kw => lower.IndexOf(kw, StringComparison.Ordinal))
            .Where(i => i >= 0)
            .DefaultIfEmpty(0)
            .Min();

        var start = Math.Max(0, firstHit - MaxExcerptChars / 4);
        var length = Math.Min(MaxExcerptChars, text.Length - start);
        return (start > 0 ? "..." : "") + text.Substring(start, length) + (start + length < text.Length ? "..." : "");
    }
}
