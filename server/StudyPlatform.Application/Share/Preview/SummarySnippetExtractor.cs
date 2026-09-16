using System.Text;
using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Share.Preview;

/// <inheritdoc />
public partial class SummarySnippetExtractor : ISummarySnippetExtractor
{
    public string Extract(string? markdown, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(markdown) || maxLength <= 0)
            return string.Empty;

        var withoutCode = CodeFence().Replace(markdown.Replace("\r\n", "\n").Replace('\r', '\n'), " ");
        var paragraph = FirstProseParagraph(withoutCode);
        var plain = CollapseWhitespace().Replace(StripInlineMarkup(paragraph), " ").Trim();

        return Truncate(plain, maxLength);
    }

    /// <summary>
    /// The first run of consecutive prose lines. Summaries routinely open with a heading, a
    /// "## Timeline Summary" section, or a bullet list; the headline of the card already carries
    /// the title, so the card wants the first thing that actually reads like a sentence.
    /// </summary>
    private static string FirstProseParagraph(string text)
    {
        var paragraph = new StringBuilder();

        foreach (var rawLine in text.Split('\n'))
        {
            var line = rawLine.Trim();

            if (line.Length == 0)
            {
                if (paragraph.Length > 0) break;
                continue;
            }

            // Skip the scaffolding a summary can open with, but only while nothing has been
            // collected — once prose has started, a blank line ends the paragraph instead.
            if (paragraph.Length == 0 && IsNotProse(line))
                continue;

            if (paragraph.Length > 0) paragraph.Append(' ');
            paragraph.Append(line);
        }

        // A summary that is nothing but headings and bullets still deserves a snippet.
        return paragraph.Length > 0 ? paragraph.ToString() : text.Replace('\n', ' ');
    }

    private static bool IsNotProse(string line) =>
        line.StartsWith('#')
        || line.StartsWith('|')
        || line.StartsWith('<')
        || HorizontalRule().IsMatch(line);

    private static string StripInlineMarkup(string text)
    {
        text = Image().Replace(text, string.Empty);
        text = Link().Replace(text, "$1");
        text = ListMarker().Replace(text, string.Empty);
        text = BlockQuote().Replace(text, string.Empty);
        text = Heading().Replace(text, string.Empty);
        text = Emphasis().Replace(text, string.Empty);
        return text;
    }

    private static string Truncate(string text, int maxLength)
    {
        if (text.Length <= maxLength) return text;

        var cut = text[..maxLength];
        var lastSpace = cut.LastIndexOf(' ');
        if (lastSpace > maxLength / 2) cut = cut[..lastSpace];

        return cut.TrimEnd(' ', ',', ';', ':', '.', '-', '–', '—') + "…";
    }

    [GeneratedRegex(@"```.*?```|~~~.*?~~~", RegexOptions.Singleline)]
    private static partial Regex CodeFence();

    [GeneratedRegex(@"^(\*{3,}|-{3,}|_{3,})$")]
    private static partial Regex HorizontalRule();

    [GeneratedRegex(@"!\[[^\]]*\]\([^)]*\)")]
    private static partial Regex Image();

    [GeneratedRegex(@"\[([^\]]*)\]\([^)]*\)")]
    private static partial Regex Link();

    [GeneratedRegex(@"(?:^|(?<= ))(?:[-*+]|\d+\.)\s+")]
    private static partial Regex ListMarker();

    [GeneratedRegex(@"(?:^|(?<= ))>\s*")]
    private static partial Regex BlockQuote();

    [GeneratedRegex(@"(?:^|(?<= ))#{1,6}\s+")]
    private static partial Regex Heading();

    [GeneratedRegex(@"[*_`~]")]
    private static partial Regex Emphasis();

    [GeneratedRegex(@"\s+")]
    private static partial Regex CollapseWhitespace();
}
