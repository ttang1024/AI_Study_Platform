using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Search.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record LibraryCitationDto(int Index, string Type, string Id, string Title, string? Url);

public record AskLibraryDto(string Answer, IReadOnlyList<LibraryCitationDto> Citations);

// ── Query ─────────────────────────────────────────────────────────────────────

/// <summary>
/// "Ask my whole library": keyword-retrieves the most relevant documents, video transcripts,
/// notes and glossary terms, then asks the AI to answer the question grounded in those
/// excerpts with [n] citations that link back to the source.
/// </summary>
public record AskLibraryQuery(Guid UserId, string Question) : IRequest<Result<AskLibraryDto>>;

public class AskLibraryQueryHandler : IRequestHandler<AskLibraryQuery, Result<AskLibraryDto>>
{
    private const int MaxSources = 6;
    private const int MaxExcerptChars = 1600;

    private static readonly HashSet<string> Stopwords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "for", "are", "was", "what", "when", "where", "which", "who", "why", "how",
        "does", "did", "can", "could", "would", "should", "this", "that", "with", "from", "into",
        "about", "between", "explain", "their", "there", "have", "has", "had", "you", "your",
    };

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;

    public AskLibraryQueryHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    private sealed record Candidate(string Type, string Id, string Title, string Text, string? Url, double Score);

    public async Task<Result<AskLibraryDto>> Handle(AskLibraryQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
            return Result<AskLibraryDto>.Failure("Question is required.", "QUESTION_REQUIRED");

        var keywords = request.Question
            .Split(' ', '\t', '\n', ',', '.', '?', '!', ';', ':', '(', ')', '"', '\'')
            .Where(w => w.Length >= 3 && !Stopwords.Contains(w))
            .Select(w => w.ToLowerInvariant())
            .Distinct()
            .ToList();
        if (keywords.Count == 0)
            keywords = new List<string> { request.Question.Trim().ToLowerInvariant() };

        var userId = request.UserId;
        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == userId, cancellationToken)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsync(v => v.UserId == userId, cancellationToken)).ToList();
        var notes = (await _unitOfWork.Notes.GetByUserIdAsync(userId, cancellationToken)).ToList();
        var terms = (await _unitOfWork.GlossaryTerms.FindAsync(t => t.UserId == userId, cancellationToken)).ToList();

        var candidates = new List<Candidate>();

        foreach (var d in documents)
        {
            var body = d.Summary ?? d.Transcript ?? string.Empty;
            var score = Score(keywords, d.FileName, body);
            if (score > 0)
                candidates.Add(new Candidate("document", d.DocumentId.ToString(), d.FileName, body, $"/documents/{d.DocumentId}", score));
        }

        foreach (var v in videos)
        {
            var body = v.Summary ?? v.Transcript ?? string.Empty;
            var score = Score(keywords, v.Title, body);
            if (score > 0)
                candidates.Add(new Candidate("video", v.VideoId.ToString(), v.Title, body, $"/videos/{v.VideoId}", score));
        }

        foreach (var n in notes)
        {
            var title = string.IsNullOrWhiteSpace(n.Title) ? "Note" : n.Title;
            var score = Score(keywords, title, n.Content);
            if (score > 0)
                candidates.Add(new Candidate("note", n.NoteId.ToString(), title!, n.Content, "/notes", score));
        }

        foreach (var t in terms)
        {
            var score = Score(keywords, t.Term, t.Definition) * 1.5; // definitions are dense, boost them
            if (score > 0)
                candidates.Add(new Candidate("glossary", t.GlossaryTermId.ToString(), t.Term, t.Definition,
                    $"/glossary?search={Uri.EscapeDataString(t.Term)}", score));
        }

        var top = candidates.OrderByDescending(c => c.Score).Take(MaxSources).ToList();
        if (top.Count == 0)
            return Result<AskLibraryDto>.Failure("Nothing in your library matches that question yet.", "NO_SOURCES");

        var citations = new List<LibraryCitationDto>();
        var contextParts = new List<string>();
        for (var i = 0; i < top.Count; i++)
        {
            var c = top[i];
            citations.Add(new LibraryCitationDto(i + 1, c.Type, c.Id, c.Title, c.Url));
            contextParts.Add($"[{i + 1}] ({c.Type}: {c.Title})\n{Excerpt(c.Text, keywords)}");
        }

        var context =
            "You are answering a question using ONLY the user's own study library excerpts below. " +
            "Cite sources inline with their bracketed number, e.g. [1] or [2], wherever you use them. " +
            "If the excerpts don't contain the answer, say so honestly.\n\n" +
            string.Join("\n\n---\n\n", contextParts);

        var answer = await _aiService.AnswerQuestionAsync(context, request.Question, cancellationToken);

        return Result<AskLibraryDto>.Success(new AskLibraryDto(answer, citations));
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
