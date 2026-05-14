# Search

## Route

`SearchController` exposes:

`GET /api/search?q=&types[]=documents&types[]=notes&types[]=flashcards&types[]=glossary&page=1&pageSize=20`

The query searches across user-owned learning content and returns typed results for the global search UI.

## Implementation

`GlobalSearchQueryHandler` fans out to four entity-specific searchers in parallel via `Task.WhenAll`, then merges, paginates, and returns the results.

```csharp
// GlobalSearchQuery.cs — parallel multi-entity search
var tasks = new List<Task<IEnumerable<SearchResultItemDto>>>();
if (types.Contains("documents"))  tasks.Add(SearchDocumentsAsync(userId, q, ct));
if (types.Contains("notes"))      tasks.Add(SearchNotesAsync(userId, q, ct));
if (types.Contains("flashcards")) tasks.Add(SearchFlashcardsAsync(userId, q, ct));
if (types.Contains("glossary"))   tasks.Add(SearchGlossaryAsync(userId, q, ct));

var allResults = await Task.WhenAll(tasks);
foreach (var batch in allResults)
    results.AddRange(batch);

var paged = results
    .Skip((request.Page - 1) * request.PageSize)
    .Take(request.PageSize)
    .ToList();
```

Each searcher loads the entity list for the user in-memory and does a case-insensitive `Contains` match. Documents match on `FileName` and `Summary`; notes on `Title` and `Content`; flashcards on `Front` and `Back`; glossary terms on `Term` and `Definition`.

`Snippet` centres a 150-character excerpt around the first match hit:

```csharp
// GlobalSearchQuery.cs — Snippet helper
private static string Snippet(string text, string query, int maxLength = 150)
{
    var idx = text.ToLowerInvariant().IndexOf(query, StringComparison.OrdinalIgnoreCase);
    if (idx < 0)
        return text[..Math.Min(maxLength, text.Length)] + (text.Length > maxLength ? "..." : "");

    var start   = Math.Max(0, idx - 40);
    var end     = Math.Min(text.Length, idx + query.Length + 80);
    return (start > 0 ? "..." : "") + text[start..end] + (end < text.Length ? "..." : "");
}
```

## Frontend

| File | Role |
| --- | --- |
| `web/src/components/common/GlobalSearch.tsx` | Sidebar/global search box |
| `web/src/pages/SearchResultsPage.tsx` | Results page |
| `web/src/services/searchService.ts` | API client |

## Related Content

Search covers the same source families represented in the library: documents, YouTube videos, articles/audio where stored as documents, notes, and generated study artifacts as supported by the backend query.
