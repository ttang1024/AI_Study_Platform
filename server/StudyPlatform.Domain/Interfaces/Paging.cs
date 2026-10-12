namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Bounds on client-supplied paging. Every list endpoint takes page/pageSize from the query string, and
/// unbounded they meant <c>page=0</c> became a negative OFFSET (a Postgres error, so a 500) and
/// <c>pageSize=1000000</c> loaded a user's whole library in one response.
/// </summary>
public static class Paging
{
    /// <summary>The largest page served. The lightweight video list asks for 500 by default to label other content.</summary>
    public const int MaxPageSize = 500;

    public static (int Page, int PageSize) Normalize(int page, int pageSize)
        => (Math.Max(1, page), Math.Clamp(pageSize, 1, MaxPageSize));

    /// <summary>One page of <paramref name="source"/>, with page and size normalized first.</summary>
    public static IQueryable<T> Page<T>(this IQueryable<T> source, int page, int pageSize)
    {
        var (p, size) = Normalize(page, pageSize);
        return source.Skip((p - 1) * size).Take(size);
    }

    /// <inheritdoc cref="Page{T}(IQueryable{T}, int, int)"/>
    public static IEnumerable<T> Page<T>(this IEnumerable<T> source, int page, int pageSize)
    {
        var (p, size) = Normalize(page, pageSize);
        return source.Skip((p - 1) * size).Take(size);
    }
}
