using MediatR;
using StudyPlatform.Application.Common;
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
    private readonly IUnitOfWork _unitOfWork;

    public GlobalSearchQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SearchResultsDto>> Handle(GlobalSearchQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return Result<SearchResultsDto>.Success(new SearchResultsDto([], 0, request.Page, request.PageSize));

        var q = request.Query.ToLowerInvariant();
        var types = request.EntityTypes?.Select(t => t.ToLowerInvariant()).ToHashSet()
                    ?? new HashSet<string> { "documents", "notes", "flashcards", "glossary" };

        var results = new List<SearchResultItemDto>();

        // Run all searches in parallel
        var tasks = new List<Task<IEnumerable<SearchResultItemDto>>>();

        if (types.Contains("documents"))
            tasks.Add(SearchDocumentsAsync(request.UserId, q, cancellationToken));
        if (types.Contains("notes"))
            tasks.Add(SearchNotesAsync(request.UserId, q, cancellationToken));
        if (types.Contains("flashcards"))
            tasks.Add(SearchFlashcardsAsync(request.UserId, q, cancellationToken));
        if (types.Contains("glossary"))
            tasks.Add(SearchGlossaryAsync(request.UserId, q, cancellationToken));

        var allResults = await Task.WhenAll(tasks);
        foreach (var batch in allResults)
            results.AddRange(batch);

        var total = results.Count;
        var paged = results
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        return Result<SearchResultsDto>.Success(new SearchResultsDto(paged, total, request.Page, request.PageSize));
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
