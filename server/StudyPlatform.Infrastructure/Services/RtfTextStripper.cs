using System.Globalization;
using System.Text;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Minimal RTF-to-plain-text converter: walks the RTF token stream, drops
/// non-text destination groups (font/color tables, embedded pictures, …) and
/// decodes hex/unicode escapes.
/// </summary>
internal static class RtfTextStripper
{
    private static readonly HashSet<string> SkippedDestinations =
    [
        "fonttbl", "colortbl", "stylesheet", "info", "pict", "object",
        "header", "footer", "headerl", "headerr", "headerf",
        "footerl", "footerr", "footerf", "footnote",
        "themedata", "colorschememapping", "latentstyles", "datastore",
        "listtable", "listoverridetable", "revtbl", "xmlnstbl",
        "fldinst", "generator", "operator", "wgrffmtfilter",
    ];

    public static string ToPlainText(string rtf)
    {
        var sb = new StringBuilder();
        var groupSkip = new Stack<bool>();
        var groupUc = new Stack<int>();
        var skip = false;
        var uc = 1;             // chars to skip after \uN (per RTF spec)
        var pendingSkip = 0;    // replacement chars still to swallow after \uN

        var i = 0;
        var n = rtf.Length;
        while (i < n)
        {
            var c = rtf[i];
            if (c == '{')
            {
                groupSkip.Push(skip);
                groupUc.Push(uc);
                i++;
                continue;
            }
            if (c == '}')
            {
                if (groupSkip.Count > 0)
                {
                    skip = groupSkip.Pop();
                    uc = groupUc.Pop();
                }
                i++;
                continue;
            }
            if (c != '\\')
            {
                if (c != '\r' && c != '\n')
                {
                    if (pendingSkip > 0) pendingSkip--;
                    else if (!skip) sb.Append(c);
                }
                i++;
                continue;
            }

            // Escape or control word.
            if (i + 1 >= n) break;
            var next = rtf[i + 1];

            if (next == '\'')
            {
                // \'hh — 8-bit character in hex
                if (i + 3 < n && byte.TryParse(rtf.AsSpan(i + 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var b))
                {
                    if (pendingSkip > 0) pendingSkip--;
                    else if (!skip) sb.Append(LegacyOfficeTextExtractor.Cp1252Char(b));
                    i += 4;
                }
                else
                {
                    i += 2;
                }
                continue;
            }

            if (!char.IsAsciiLetter(next))
            {
                // Control symbol.
                if (next == '*')
                {
                    // \* introduces an ignorable destination — skip the group.
                    skip = true;
                }
                else if (!skip)
                {
                    switch (next)
                    {
                        case '\\' or '{' or '}': sb.Append(next); break;
                        case '~': sb.Append(' '); break;
                        case '-': break; // optional hyphen
                        case '_': sb.Append('-'); break;
                        case '\r' or '\n': sb.Append('\n'); break; // \<newline> = \par
                    }
                }
                i += 2;
                continue;
            }

            // Control word: letters, optional signed numeric parameter,
            // optional single delimiter space.
            var j = i + 1;
            while (j < n && char.IsAsciiLetter(rtf[j])) j++;
            var word = rtf[(i + 1)..j];

            var param = 0;
            var hasParam = false;
            if (j < n && (rtf[j] == '-' || char.IsAsciiDigit(rtf[j])))
            {
                hasParam = true;
                var negative = rtf[j] == '-';
                if (negative) j++;
                var digitsStart = j;
                while (j < n && char.IsAsciiDigit(rtf[j])) j++;
                int.TryParse(rtf.AsSpan(digitsStart, j - digitsStart), out param);
                if (negative) param = -param;
            }
            if (j < n && rtf[j] == ' ') j++;
            i = j;

            if (word == "uc")
            {
                uc = hasParam ? param : 1;
                continue;
            }
            if (word == "u")
            {
                if (pendingSkip > 0) pendingSkip--;
                else if (!skip)
                {
                    var cp = param < 0 ? param + 65536 : param;
                    if (cp is > 0 and <= 0xFFFF) sb.Append((char)cp);
                }
                pendingSkip += uc; // swallow the fallback replacement chars
                continue;
            }
            if (skip)
                continue;
            if (SkippedDestinations.Contains(word))
            {
                skip = true;
                continue;
            }

            switch (word)
            {
                case "par" or "line" or "sect" or "page": sb.Append('\n'); break;
                case "tab" or "cell": sb.Append('\t'); break;
                case "row": sb.Append('\n'); break;
                case "emdash": sb.Append('—'); break;
                case "endash": sb.Append('–'); break;
                case "bullet": sb.Append('•'); break;
                case "lquote": sb.Append('‘'); break;
                case "rquote": sb.Append('’'); break;
                case "ldblquote": sb.Append('“'); break;
                case "rdblquote": sb.Append('”'); break;
                case "emspace" or "enspace" or "qmspace": sb.Append(' '); break;
            }
        }

        return sb.ToString();
    }
}
