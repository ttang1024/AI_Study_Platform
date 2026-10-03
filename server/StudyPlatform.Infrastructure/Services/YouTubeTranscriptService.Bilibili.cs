using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace StudyPlatform.Infrastructure.Services;

// Bilibili support: view/subtitle APIs, WBI URL signing & subtitle parsing.
public partial class YouTubeTranscriptService
{
    private sealed record BilibiliViewData(string Title, string Pic, IReadOnlyList<BilibiliPage> Pages);
    private sealed record BilibiliPage(int PageNumber, long Cid, string Part);
    private sealed record BilibiliSubtitleEntry(string Lan, string LanDoc, string SubtitleUrl);

    private static readonly int[] MixinKeyEncTab =
    [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
        27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
        37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
        22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
    ];

    private static (string? Bvid, int Page) ParseBilibiliUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var match = Regex.Match(uri.AbsolutePath, @"/video/(BV[0-9A-Za-z]+)", RegexOptions.IgnoreCase);
            if (!match.Success) return (null, 1);

            var bvid = match.Groups[1].Value;
            var page = 1;
            foreach (var param in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = param.Split('=', 2);
                if (parts.Length == 2 && parts[0] == "p" && int.TryParse(parts[1], out var p) && p > 0)
                {
                    page = p;
                    break;
                }
            }
            return (bvid, page);
        }
        catch
        {
            return (null, 1);
        }
    }

    private static string NormalizeBilibiliImageUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "";
        if (url.StartsWith("//", StringComparison.Ordinal)) return "https:" + url;
        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) return "https://" + url[7..];
        return url;
    }

    private async Task<BilibiliViewData?> GetBilibiliViewAsync(string bvid, CancellationToken ct)
    {
        var cacheKey = $"bilibili_view:{bvid}";
        if (_cache.TryGetValue(cacheKey, out BilibiliViewData? cached))
            return cached;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get,
                $"https://api.bilibili.com/x/web-interface/view?bvid={Uri.EscapeDataString(bvid)}");
            AddBilibiliHeaders(request);
            var response = await _httpClient.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return null;

            var title = data.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var pic = NormalizeBilibiliImageUrl(data.TryGetProperty("pic", out var p) ? p.GetString() ?? "" : "");

            var pages = new List<BilibiliPage>();
            if (data.TryGetProperty("pages", out var pagesArr))
            {
                foreach (var pageEl in pagesArr.EnumerateArray())
                {
                    var pageNum = pageEl.TryGetProperty("page", out var pn) ? pn.GetInt32() : 0;
                    var cid = pageEl.TryGetProperty("cid", out var c) ? c.GetInt64() : 0;
                    var part = pageEl.TryGetProperty("part", out var pt) ? pt.GetString() ?? "" : "";
                    pages.Add(new BilibiliPage(pageNum, cid, part));
                }
            }

            var viewData = new BilibiliViewData(title, pic, pages);
            _cache.Set(cacheKey, viewData, TimeSpan.FromMinutes(30));
            return viewData;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Bilibili view data for {Bvid}", bvid);
            return null;
        }
    }

    private async Task<IReadOnlyList<BilibiliSubtitleEntry>?> GetBilibiliSubtitleListAsync(
        string bvid, long cid, CancellationToken ct)
    {
        try
        {
            var parameters = new Dictionary<string, string>
            {
                ["bvid"] = bvid,
                ["cid"] = cid.ToString()
            };

            var url = await BuildWbiSignedUrlAsync(
                "https://api.bilibili.com/x/player/wbi/v2", parameters, ct);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            AddBilibiliHeaders(request);
            var response = await _httpClient.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return null;
            if (!data.TryGetProperty("subtitle", out var subtitle)) return null;
            if (!subtitle.TryGetProperty("subtitles", out var subtitles)) return null;

            var result = new List<BilibiliSubtitleEntry>();
            foreach (var s in subtitles.EnumerateArray())
            {
                var lan = s.TryGetProperty("lan", out var l) ? l.GetString() ?? "" : "";
                var lanDoc = s.TryGetProperty("lan_doc", out var ld) ? ld.GetString() ?? "" : "";
                var subUrl = s.TryGetProperty("subtitle_url", out var su) ? su.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(subUrl))
                    result.Add(new BilibiliSubtitleEntry(lan, lanDoc, subUrl));
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Bilibili subtitle list for {Bvid}/{Cid}", bvid, cid);
            return null;
        }
    }

    private async Task<IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)>?> GetBilibiliCaptionsAsync(
        string videoUrl, CancellationToken ct)
    {
        var (bvid, page) = ParseBilibiliUrl(videoUrl);
        if (bvid == null) return null;

        var viewData = await GetBilibiliViewAsync(bvid, ct);
        if (viewData == null) return null;

        var pageData = viewData.Pages.FirstOrDefault(p => p.PageNumber == page)
            ?? viewData.Pages.FirstOrDefault();
        if (pageData == null) return null;

        var subtitleList = await GetBilibiliSubtitleListAsync(bvid, pageData.Cid, ct);
        if (subtitleList == null || subtitleList.Count == 0) return null;

        var preferred = subtitleList
            .OrderBy(s => GetBilibiliSubtitlePriority(s.Lan))
            .First();

        var subtitleUrl = preferred.SubtitleUrl.StartsWith("//")
            ? "https:" + preferred.SubtitleUrl
            : preferred.SubtitleUrl;

        try
        {
            var subtitleJson = await _httpClient.GetStringAsync(subtitleUrl, ct);
            return ParseBilibiliSubtitles(subtitleJson);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to download Bilibili subtitle from {Url}", subtitleUrl);
            return null;
        }
    }

    private static int GetBilibiliSubtitlePriority(string lan)
    {
        var lower = lan.ToLowerInvariant();
        if (lower is "zh-cn" or "zh_cn") return 0;
        if (lower.StartsWith("ai-zh")) return 1;
        if (lower.StartsWith("zh")) return 2;
        if (lower == "en") return 3;
        return 4;
    }

    private static IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> ParseBilibiliSubtitles(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var result = new List<(TimeSpan, TimeSpan, string)>();

        if (!doc.RootElement.TryGetProperty("body", out var body)) return result;

        foreach (var item in body.EnumerateArray())
        {
            var from = item.TryGetProperty("from", out var f) ? f.GetDouble() : 0.0;
            var to = item.TryGetProperty("to", out var t) ? t.GetDouble() : 0.0;
            var content = item.TryGetProperty("content", out var c) ? c.GetString()?.Trim() ?? "" : "";

            if (string.IsNullOrEmpty(content)) continue;
            result.Add((TimeSpan.FromSeconds(from), TimeSpan.FromSeconds(Math.Max(0, to - from)), content));
        }

        return result;
    }

    private static void AddBilibiliHeaders(HttpRequestMessage request)
    {
        request.Headers.TryAddWithoutValidation("Referer", "https://www.bilibili.com");
        request.Headers.TryAddWithoutValidation("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    }

    // ── WBI signing ───────────────────────────────────────────────────────────

    private async Task<(string ImgKey, string SubKey)> GetWbiKeysAsync(CancellationToken ct)
    {
        const string cacheKey = "bilibili_wbi_keys";
        if (_cache.TryGetValue(cacheKey, out (string, string) cached))
            return cached;

        var request = new HttpRequestMessage(HttpMethod.Get, "https://api.bilibili.com/x/web-interface/nav");
        AddBilibiliHeaders(request);
        var response = await _httpClient.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        using var doc = JsonDocument.Parse(json);
        var wbiImg = doc.RootElement.GetProperty("data").GetProperty("wbi_img");
        var imgUrl = wbiImg.GetProperty("img_url").GetString() ?? "";
        var subUrl = wbiImg.GetProperty("sub_url").GetString() ?? "";

        var imgKey = Path.GetFileNameWithoutExtension(new Uri(imgUrl).AbsolutePath);
        var subKey = Path.GetFileNameWithoutExtension(new Uri(subUrl).AbsolutePath);

        var keys = (imgKey, subKey);
        _cache.Set(cacheKey, keys, TimeSpan.FromHours(12));
        return keys;
    }

    private static string GetMixinKey(string imgKey, string subKey)
    {
        var s = imgKey + subKey;
        return new string(MixinKeyEncTab.Take(32).Select(i => s[i]).ToArray());
    }

    private async Task<string> BuildWbiSignedUrlAsync(
        string baseUrl, Dictionary<string, string> parameters, CancellationToken ct)
    {
        var (imgKey, subKey) = await GetWbiKeysAsync(ct);
        var mixinKey = GetMixinKey(imgKey, subKey);

        parameters["wts"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

        var query = string.Join("&",
            parameters
                .OrderBy(p => p.Key)
                .Select(p =>
                {
                    var val = new string(p.Value.Where(c => !"!'()*".Contains(c)).ToArray());
                    return $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(val)}";
                }));

        var wRid = Convert.ToHexString(
            MD5.HashData(Encoding.UTF8.GetBytes(query + mixinKey))).ToLowerInvariant();

        return $"{baseUrl}?{query}&w_rid={wRid}";
    }

    private static bool IsBilibiliUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var uri)
           && uri.Host.Contains("bilibili.com", StringComparison.OrdinalIgnoreCase);

    private static string ToSimplifiedChinese(string text)
    {
        if (string.IsNullOrEmpty(text)) return text;

        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
            sb.Append(TraditionalToSimplifiedMap.TryGetValue(ch, out var simplified) ? simplified : ch);
        return sb.ToString();
    }

    private static readonly IReadOnlyDictionary<char, char> TraditionalToSimplifiedMap = new Dictionary<char, char>
    {
        ['學'] = '学', ['習'] = '习', ['講'] = '讲', ['課'] = '课', ['視'] = '视', ['頻'] = '频',
        ['設'] = '设', ['計'] = '计', ['開'] = '开', ['發'] = '发', ['項'] = '项', ['實'] = '实',
        ['戰'] = '战', ['聽'] = '听', ['網'] = '网', ['站'] = '站', ['領'] = '领', ['驅'] = '驱',
        ['動'] = '动', ['務'] = '务', ['後'] = '后', ['端'] = '端', ['離'] = '离', ['層'] = '层',
        ['個'] = '个', ['們'] = '们', ['這'] = '这', ['那'] = '那', ['裡'] = '里', ['裏'] = '里',
        ['麼'] = '么', ['為'] = '为', ['與'] = '与', ['對'] = '对', ['從'] = '从', ['會'] = '会',
        ['來'] = '来', ['時'] = '时', ['還'] = '还', ['過'] = '过', ['現'] = '现', ['種'] = '种',
        ['樣'] = '样', ['點'] = '点', ['應'] = '应', ['當'] = '当', ['說'] = '说', ['讓'] = '让',
        ['問'] = '问', ['題'] = '题', ['義'] = '义', ['類'] = '类', ['總'] = '总', ['結'] = '结',
        ['構'] = '构', ['數'] = '数', ['據'] = '据', ['庫'] = '库', ['碼'] = '码', ['標'] = '标',
        ['準'] = '准', ['讀'] = '读', ['寫'] = '写', ['錄'] = '录', ['傳'] = '传', ['轉'] = '转',
        ['換'] = '换', ['態'] = '态', ['線'] = '线', ['進'] = '进', ['選'] = '选', ['擇'] = '择',
        ['創'] = '创', ['建'] = '建', ['刪'] = '删', ['除'] = '除', ['訂'] = '订', ['單'] = '单',
        ['頁'] = '页', ['檔'] = '档', ['案'] = '案', ['關'] = '关', ['閉'] = '闭', ['啟'] = '启',
        ['權'] = '权', ['限'] = '限', ['驗'] = '验', ['證'] = '证', ['認'] = '认',
        ['陸'] = '陆', ['戶'] = '户', ['組'] = '组', ['織'] = '织', ['產'] = '产',
        ['品'] = '品', ['質'] = '质', ['優'] = '优', ['化'] = '化', ['緩'] = '缓', ['存'] = '存',
        ['載'] = '载', ['獲'] = '获', ['取'] = '取', ['響'] = '响', ['異'] = '异', ['常'] = '常',
        ['錯'] = '错', ['誤'] = '误', ['處'] = '处', ['理'] = '理', ['調'] = '调', ['試'] = '试',
        ['併'] = '并', ['並'] = '并', ['貝'] = '贝', ['員'] = '员', ['運'] = '运', ['維'] = '维',
        ['廣'] = '广', ['場'] = '场', ['區'] = '区', ['國'] = '国', ['門'] = '门', ['間'] = '间',
        ['屬'] = '属', ['性'] = '性', ['繼'] = '继', ['續'] = '续', ['擴'] = '扩', ['展'] = '展',
        ['該'] = '该', ['語'] = '语', ['言'] = '言', ['編'] = '编', ['譯'] = '译', ['器'] = '器',
        ['資'] = '资', ['源'] = '源', ['壓'] = '压', ['縮'] = '缩', ['復'] = '复',
        ['雜'] = '杂', ['簡'] = '简', ['體'] = '体', ['繁'] = '繁', ['參'] = '参',
        ['導'] = '导', ['覽'] = '览', ['畫'] = '画', ['面'] = '面', ['顯'] = '显', ['示'] = '示',
        ['長'] = '长', ['短'] = '短', ['節'] = '节', ['鐘'] = '钟',
        ['測'] = '测', ['聯'] = '联', ['繫'] = '系',
        ['狀'] = '状', ['圖'] = '图', ['記'] = '记', ['範'] = '范',
        ['圍'] = '围', ['獨'] = '独', ['立'] = '立', ['級'] = '级', ['別'] = '别', ['萬'] = '万',
        ['億'] = '亿', ['餘'] = '余', ['確'] = '确',
    };

    // ── yt-dlp subprocess with proxy+cookie rotation ──────────────────────────

}
