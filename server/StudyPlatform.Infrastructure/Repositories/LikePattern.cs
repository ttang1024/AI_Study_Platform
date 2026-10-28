namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// ILIKE patterns built from what a user typed. Their text has to match literally: unescaped, a search for
/// "%" returned the whole library and "file_1" matched "fileX1". Pass <see cref="Escape"/> as ILike's third
/// argument — without it Npgsql emits <c>ESCAPE ''</c>, which switches escaping off.
/// </summary>
internal static class LikePattern
{
    public const string Escape = @"\";

    /// <summary>A pattern matching any value that contains <paramref name="text"/>.</summary>
    public static string Contains(string text)
        => $"%{text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_")}%";
}
