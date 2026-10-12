using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Videos;

/// <summary>Turns a pasted video URL into the id the transcript services key on.</summary>
public static class VideoUrls
{
    /// <summary>
    /// The video id in a YouTube URL (watch, youtu.be, shorts, embed) or a Bilibili one (BV id, with
    /// <c>:pN</c> for a page beyond the first); null when the URL is neither.
    /// </summary>
    public static string? ExtractVideoId(string videoUrl)
    {
        try
        {
            var uri = new Uri(videoUrl);
            if (uri.Host.Contains("bilibili.com", StringComparison.OrdinalIgnoreCase))
            {
                var match = Regex.Match(uri.AbsolutePath, @"/video/(?<id>BV[0-9A-Za-z]+)", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var page = 1;
                    foreach (var param in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
                    {
                        var parts = param.Split('=', 2);
                        if (parts.Length == 2 && parts[0] == "p" && int.TryParse(parts[1], out var parsed) && parsed > 1)
                        {
                            page = parsed;
                            break;
                        }
                    }

                    var bvid = match.Groups["id"].Value;
                    return page > 1 ? $"{bvid}:p{page}" : bvid;
                }
            }
            if (uri.Host.Contains("youtu.be"))
                return uri.AbsolutePath.TrimStart('/').Split('?')[0];
            // Parse ?v= from query string without System.Web dependency
            foreach (var param in uri.Query.TrimStart('?').Split('&'))
            {
                var parts = param.Split('=', 2);
                if (parts.Length == 2 && parts[0] == "v" && !string.IsNullOrEmpty(parts[1]))
                    return Uri.UnescapeDataString(parts[1]);
            }
            var segments = uri.AbsolutePath.Split('/');
            for (var i = 0; i < segments.Length - 1; i++)
                if (segments[i] is "shorts" or "embed")
                    return segments[i + 1];
        }
        catch { }
        return null;
    }
}
