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

public class GlobalSearchQueryHandler : IRequestHandler<GlobalSearchQuery, Result<SearchResultsDto>>
{
    // Semantic fallback: below this many exact matches, expand the query into
    // AI-suggested synonyms/related phrases and search those too.
    private const int SemanticExpansionThreshold = 5;
    private const int MaxExpansionTerms = 6;
    private static readonly TimeSpan ExpansionCacheTtl = TimeSpan.FromDays(7);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly IAppCache _cache;
    private readonly ILogger<GlobalSearchQueryHandler> _logger;

    public GlobalSearchQueryHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        IAppCache cache,
        ILogger<GlobalSearchQueryHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<SearchResultsDto>> Handle(GlobalSearchQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return Result<SearchResultsDto>.Success(new SearchResultsDto([], 0, request.Page, request.PageSize));

        var q = request.Query.ToLowerInvariant();
        var types = request.EntityTypes?.Select(t => t.ToLowerInvariant()).ToHashSet()
                    ?? new HashSet<string> { "documents", "notes", "flashcards", "glossary" };

        var results = await SearchAllAsync(request.UserId, q, types, cancellationToken);

        // Semantic layer: when the literal query barely matches, retry with
        // meaning-adjacent terms so "heart attack" also finds "myocardial infarction".
        if (results.Count < SemanticExpansionThreshold && q.Length >= 3)
        {
            var seen = results.Select(r => $"{r.Type}:{r.Id}").ToHashSet();
            foreach (var term in await ExpandQueryAsync(q, cancellationToken))
            {
                var extra = await SearchAllAsync(request.UserId, term, types, cancellationToken);
                foreach (var item in extra)
                {
                    if (seen.Add($"{item.Type}:{item.Id}"))
                        results.Add(item);
                }
            }
        }

        var total = results.Count;
        var paged = results
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        return Result<SearchResultsDto>.Success(new SearchResultsDto(paged, total, request.Page, request.PageSize));
    }

    private async Task<List<SearchResultItemDto>> SearchAllAsync(
        Guid userId, string q, HashSet<string> types, CancellationToken cancellationToken)
    {
        // Run all category searches in parallel
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

    /// <summary>AI synonyms/related phrases for the query, cached a week per distinct query.</summary>
    private async Task<IReadOnlyList<string>> ExpandQueryAsync(string q, CancellationToken cancellationToken)
    {
        try
        {
            var expansions = await _cache.GetOrCreateAsync(
                $"search:expand:{q}",
                async ct =>
                {
                    var reply = await _aiService.GeneralChatAsync(
                        Array.Empty<(string, string)>(),
                        $"List up to {MaxExpansionTerms} alternative search keywords (synonyms, related terms, translations if the query is not English) for: \"{q}\". " +
                        "Reply with ONLY the terms, comma-separated, no numbering or explanation.",
                        ct);
                    return reply.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(t => t.Trim('"', '\'', '.').ToLowerInvariant())
                        .Where(t => t.Length >= 2 && t != q)
                        .Distinct()
                        .Take(MaxExpansionTerms)
                        .ToArray();
                },
                ExpansionCacheTtl,
                cancellationToken);
            return expansions ?? Array.Empty<string>();
        }
        catch (Exception ex)
        {
            // Search must never fail because expansion did — degrade to exact matches.
            _logger.LogWarning(ex, "Semantic query expansion failed for {Query}", q);
            return Array.Empty<string>();
        }
    }

    // Each category is filtered in SQL (ILike) and capped, rather than pulling every row for the
    // user into memory and scanning in C#. The cap is generous relative to what the paged UI shows.
    private const int PerCategoryLimit = 100;

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
