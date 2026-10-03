using System.Text;
using MimeKit;
using OpenMcdf;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Text extraction for email formats: RFC-822 (.eml) and MHTML web archives
/// via MimeKit, Outlook .msg (OLE compound file with MAPI property streams).
/// </summary>
internal static class EmailTextExtractor
{
    public static string ExtractEml(byte[] data)
    {
        using var ms = new MemoryStream(data);
        var message = MimeMessage.Load(ms);

        var sb = new StringBuilder();
        AppendHeader(sb, "Subject", message.Subject);
        AppendHeader(sb, "From", message.From.ToString());
        AppendHeader(sb, "To", message.To.ToString());
        if (message.Date != default)
            AppendHeader(sb, "Date", message.Date.ToString("yyyy-MM-dd HH:mm"));
        sb.AppendLine();

        var body = message.TextBody;
        if (string.IsNullOrWhiteSpace(body) && message.HtmlBody != null)
            body = DocumentTextExtractorService.ExtractFromHtml(message.HtmlBody);
        sb.AppendLine(body ?? string.Empty);

        return sb.ToString();
    }

    // MHTML (saved web page archive) is MIME: the page is the text/html part.
    public static string ExtractMhtml(byte[] data)
    {
        using var ms = new MemoryStream(data);
        var message = MimeMessage.Load(ms);

        var html = message.HtmlBody;
        if (html == null)
        {
            var htmlPart = message.BodyParts.OfType<TextPart>().FirstOrDefault(p => p.IsHtml);
            html = htmlPart?.Text;
        }
        if (html != null)
            return DocumentTextExtractorService.ExtractFromHtml(html);

        return message.TextBody ?? string.Empty;
    }

    // ── Outlook .msg ([MS-OXMSG]) ─────────────────────────────────────────

    private const string SubjectProp = "0037";
    private const string SenderNameProp = "0C1A";
    private const string DisplayToProp = "0E04";
    private const string BodyProp = "1000";

    public static string ExtractMsg(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var root = RootStorage.Open(ms);

        var streamNames = root.EnumerateEntries()
            .Where(e => e.Type == EntryType.Stream)
            .Select(e => e.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var sb = new StringBuilder();
        AppendHeader(sb, "Subject", ReadStringProperty(root, streamNames, SubjectProp));
        AppendHeader(sb, "From", ReadStringProperty(root, streamNames, SenderNameProp));
        AppendHeader(sb, "To", ReadStringProperty(root, streamNames, DisplayToProp));
        sb.AppendLine();
        sb.AppendLine(ReadStringProperty(root, streamNames, BodyProp) ?? string.Empty);

        return sb.ToString();
    }

    // MAPI string properties live in "__substg1.0_<prop><type>" streams;
    // type 001F is UTF-16LE, 001E is 8-bit.
    private static string? ReadStringProperty(RootStorage root, HashSet<string> streamNames, string propId)
    {
        foreach (var (typeSuffix, unicode) in new[] { ("001F", true), ("001E", false) })
        {
            var name = $"__substg1.0_{propId}{typeSuffix}";
            if (!streamNames.Contains(name))
                continue;

            using var stream = root.OpenStream(name);
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            var bytes = ms.ToArray();
            return unicode ? Encoding.Unicode.GetString(bytes) : Encoding.Latin1.GetString(bytes);
        }
        return null;
    }

    private static void AppendHeader(StringBuilder sb, string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            sb.AppendLine($"{name}: {value}");
    }
}
