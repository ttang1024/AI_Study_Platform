using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Search.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record SearchResultItemDto(
    string Id,
    string Type,
    string Title,
    string Snippet,
    string? Url);

public record SearchResultsDto(
    IEnumerable<SearchResultItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

// ── Query ─────────────────────────────────────────────────────────────────────

public record GlobalSearchQuery(
    Guid UserId,
    string Query,
    string[]? EntityTypes,
    int Page,
    int PageSize) : IRequest<Result<SearchResultsDto>>;

/// <summary>
/// Hybrid search. Keyword matching finds the exact string the user typed; semantic matching finds the
/// passages that mean the same thing ("heart attack" → "myocardial infarction"). Neither subsumes the
/// other, so both run and the results are merged: keyword hits rank first because an exact match is
/// almost always what someone typing an exact phrase wants, with semantic hits filling in behind.
/// When embeddings are unconfigured this degrades cleanly to keyword-only.
/// </summary>
public class GlobalSearchQueryHandler : IRequestHandler<GlobalSearchQuery, Result<SearchResultsDto>>
{
    // Each category is filtered in SQL and capped, rather than pulling every row for the user into
    // memory and scanning in C#. The cap is generous relative to what the paged UI shows.
    private const int PerCategoryLimit = 100;
    private const int SemanticLimit = 40;

    /// <summary>
    /// Cosine distance beyond which a chunk isn't really "about" the query. Vector search always
    /// returns its k nearest neighbours, however far away they are, so without a cutoff every query
    /// would return something — a confidently irrelevant something.
    /// </summary>
    private const double MaxSemanticDistance = 0.55;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingIndex _embeddingIndex;
    private readonly ILogger<GlobalSearchQueryHandler> _logger;

    public GlobalSearchQueryHandler(
        IUnitOfWork unitOfWork,
        IEmbeddingIndex embeddingIndex,
        ILogger<GlobalSearchQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _embeddingIndex = embeddingIndex;
        _logger = logger;
    }

    public async Task<Result<SearchResultsDto>> Handle(GlobalSearchQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return Result<SearchResultsDto>.Success(new SearchResultsDto([], 0, request.Page, request.PageSize));

        var q = request.Query.ToLowerInvariant();
        var types = request.EntityTypes?.Select(t => t.ToLowerInvariant()).ToHashSet()
                    ?? new HashSet<string> { "documents", "notes", "flashcards", "glossary" };

        var keywordTask = SearchKeywordAsync(request.UserId, q, types, cancellationToken);
        var semanticTask = SearchSemanticAsync(request.UserId, request.Query, types, cancellationToken);
        await Task.WhenAll(keywordTask, semanticTask);

        var results = keywordTask.Result;
        var seen = results.Select(r => $"{r.Type}:{r.Id}").ToHashSet();
        foreach (var item in semanticTask.Result)
        {
            if (seen.Add($"{item.Type}:{item.Id}"))
                results.Add(item);
        }

        var total = results.Count;
        var paged = results
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        return Result<SearchResultsDto>.Success(new SearchResultsDto(paged, total, request.Page, request.PageSize));
    }

    // ── Semantic ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Flashcards aren't embedded (they're short prompts, not prose), so the semantic layer covers the
    /// other three categories and the keyword layer continues to cover all four.
    /// </summary>
    private static readonly Dictionary<string, string> SemanticTypeByCategory = new()
    {
        ["documents"] = "document",
        ["notes"] = "note",
        ["glossary"] = "glossary",
    };

    private async Task<List<SearchResultItemDto>> SearchSemanticAsync(
        Guid userId, string query, HashSet<string> categories, CancellationToken cancellationToken)
    {
        var sourceTypes = SemanticTypeByCategory
            .Where(kv => categories.Contains(kv.Key))
            .Select(kv => kv.Value)
            .ToList();

        // Videos have no category of their own in this UI, but their transcripts are indexed and are
        // usually the best answer to a "what did the lecture say about X" query, so include them
        // whenever documents are in scope.
        if (categories.Contains("documents"))
            sourceTypes.Add("video");

        if (sourceTypes.Count == 0)
            return [];

        try
        {
            var hits = await _embeddingIndex.SearchAsync(userId, query, sourceTypes, SemanticLimit, cancellationToken);

            return hits
                .Where(h => h.Distance <= MaxSemanticDistance)
                // One source can match on several chunks; show the source once, at its best chunk.
                .GroupBy(h => (h.SourceType, h.SourceId))
                .Select(g => g.OrderBy(h => h.Distance).First())
                .OrderBy(h => h.Distance)
                .Select(h => new SearchResultItemDto(
                    h.SourceId.ToString(),
                    h.SourceType,
                    h.Title,
                    Truncate(h.Text, 150),
                    UrlFor(h.SourceType, h.SourceId, h.Title)))
                .ToList();
        }
        catch (Exception ex)
        {
            // Semantic search is an enhancement — never let it take the keyword results down with it.
            _logger.LogWarning(ex, "Semantic search failed for query {Query}; returning keyword results only", query);
            return [];
        }
    }

    private static string? UrlFor(string sourceType, Guid sourceId, string title) => sourceType switch
    {
        "document" => $"/documents/{sourceId}",
        "video" => $"/videos/{sourceId}",
        "glossary" => $"/glossary?search={Uri.EscapeDataString(title)}",
        _ => null,
    };

    // ── Keyword ───────────────────────────────────────────────────────────────

    private async Task<List<SearchResultItemDto>> SearchKeywordAsync(
        Guid userId, string q, HashSet<string> types, CancellationToken cancellationToken)
    {
        var tasks = new List<Task<IEnumerable<SearchResultItemDto>>>();

        if (types.Contains("documents"))
            tasks.Add(SearchDocumentsAsync(userId, q, cancellationToken));
        if (types.Contains("notes"))
            tasks.Add(SearchNotesAsync(userId, q, cancellationToken));
        if (types.Contains("flashcards"))
            tasks.Add(SearchFlashcardsAsync(userId, q, cancellationToken));
        if (types.Contains("glossary"))
            tasks.Add(SearchGlossaryAsync(userId, q, cancellationToken));

        var allResults = await Task.WhenAll(tasks);
        return allResults.SelectMany(batch => batch).ToList();
    }

    private async Task<IEnumerable<SearchResultItemDto>> SearchDocumentsAsync(
        Guid userId, string q, CancellationToken cancellationToken)
    {
        var docs = await _unitOfWork.Documents.SearchByUserAsync(userId, q, PerCategoryLimit, cancellationToken);
        return docs.Select(d => new SearchResultItemDto(
            d.DocumentId.ToString(),
            "document",
            d.FileName,
            Snippet(d.Summary ?? d.FileName, q),
            $"/documents/{d.DocumentId}"));
    }

    private async Task<IEnumerable<SearchResultItemDto>> SearchNotesAsync(
        Guid userId, string q, CancellationToken cancellationToken)
    {
        var notes = await _unitOfWork.Notes.SearchByUserAsync(userId, q, PerCategoryLimit, cancellationToken);
        return notes.Select(n => new SearchResultItemDto(
            n.NoteId.ToString(),
            "note",
            n.Title ?? n.Content[..Math.Min(60, n.Content.Length)],
            Snippet(n.Content, q),
            null));
    }

    private async Task<IEnumerable<SearchResultItemDto>> SearchFlashcardsAsync(
        Guid userId, string q, CancellationToken cancellationToken)
    {
        var cards = await _unitOfWork.Flashcards.SearchByUserAsync(userId, q, PerCategoryLimit, cancellationToken);
        return cards.Select(f => new SearchResultItemDto(
            f.FlashcardId.ToString(),
            "flashcard",
            f.Front,
            Snippet(f.Back, q),
            "/flashcards"));
    }

    private async Task<IEnumerable<SearchResultItemDto>> SearchGlossaryAsync(
        Guid userId, string q, CancellationToken cancellationToken)
    {
        var terms = await _unitOfWork.GlossaryTerms.SearchByUserAsync(userId, q, PerCategoryLimit, cancellationToken);
        return terms.Select(t => new SearchResultItemDto(
            t.GlossaryTermId.ToString(),
            "glossary",
            t.Term,
            Snippet(t.Definition, q),
            "/glossary"));
    }

    private static string Truncate(string text, int maxLength)
        => text.Length <= maxLength ? text : text[..maxLength] + "...";

    private static string Snippet(string text, string query, int maxLength = 150)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var idx = text.ToLowerInvariant().IndexOf(query, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            return text[..Math.Min(maxLength, text.Length)] + (text.Length > maxLength ? "..." : string.Empty);

        var start = Math.Max(0, idx - 40);
        var end = Math.Min(text.Length, idx + query.Length + 80);
        var snippet = (start > 0 ? "..." : "") + text[start..end] + (end < text.Length ? "..." : "");
        return snippet;
    }
}
