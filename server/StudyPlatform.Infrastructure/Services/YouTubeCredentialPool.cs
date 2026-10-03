using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Thread-safe singleton that manages a pool of residential proxies and cookie sets for yt-dlp.
/// Failed proxies/cookies are put on a cooldown before being retried.
/// </summary>
public sealed class YouTubeCredentialPool
{
    private readonly IReadOnlyList<string> _proxies;
    private readonly IReadOnlyList<byte[]> _cookies;
    private readonly TimeSpan _cooldown;
    private readonly ILogger<YouTubeCredentialPool> _logger;

    private readonly ConcurrentDictionary<string, DateTimeOffset> _proxyFailures = new();
    private readonly ConcurrentDictionary<int, DateTimeOffset> _cookieFailures = new();

    private long _proxyCounter;
    private long _cookieCounter;

    public YouTubeCredentialPool(IConfiguration configuration, ILogger<YouTubeCredentialPool> logger)
    {
        _logger = logger;
        _cooldown = TimeSpan.FromMinutes(
            double.TryParse(configuration["YouTube:ProxyCooldownMinutes"], out var m) ? m : 5);

        _proxies = LoadProxies(configuration);
        _cookies = LoadCookies(configuration);

        logger.LogInformation(
            "YouTubeCredentialPool: {ProxyCount} proxies, {CookieCount} cookie set(s), cooldown {Cooldown}",
            _proxies.Count, _cookies.Count, _cooldown);
    }

    public int ProxyCount => _proxies.Count;
    public int CookieCount => _cookies.Count;

    /// <summary>
    /// Returns the next available (proxy, cookieIndex, cookieBytes) from the pool.
    /// Skips proxies/cookies that are currently on cooldown.
    /// </summary>
    public (string? Proxy, int CookieIndex, byte[]? CookieBytes) GetNext()
    {
        var proxy = GetNextProxy();
        var (idx, bytes) = GetNextCookie();
        return (proxy, idx, bytes);
    }

    /// <summary>
    /// Returns a different proxy from the one specified, skipping failed ones where possible.
    /// Used when retrying after a proxy failure.
    /// </summary>
    public (string? Proxy, int CookieIndex, byte[]? CookieBytes) GetNextExcludingProxy(string? failedProxy)
    {
        var proxy = GetNextProxyExcluding(failedProxy);
        var (idx, bytes) = GetNextCookie();
        return (proxy, idx, bytes);
    }

    /// <summary>
    /// Returns a different cookie from the one specified, keeping the same proxy.
    /// Used when retrying after bot detection.
    /// </summary>
    public (string? Proxy, int CookieIndex, byte[]? CookieBytes) GetNextExcludingCookie(string? proxy, int failedCookieIndex)
    {
        var (idx, bytes) = GetNextCookieExcluding(failedCookieIndex);
        return (proxy, idx, bytes);
    }

    public void ReportProxyFailure(string? proxy)
    {
        if (string.IsNullOrEmpty(proxy)) return;
        _proxyFailures[proxy] = DateTimeOffset.UtcNow;
        _logger.LogWarning("Proxy {Proxy} marked failed (cooldown {Cooldown})", proxy, _cooldown);
    }

    public void ReportCookieFailure(int cookieIndex)
    {
        if (cookieIndex < 0) return;
        _cookieFailures[cookieIndex] = DateTimeOffset.UtcNow;
        _logger.LogWarning("Cookie #{Index} marked failed (cooldown {Cooldown})", cookieIndex, _cooldown);
    }

    private string? GetNextProxy()
    {
        if (_proxies.Count == 0) return null;
        return PickAvailable(_proxies, _proxyFailures, ref _proxyCounter, excludeProxy: null);
    }

    private string? GetNextProxyExcluding(string? excluded)
    {
        if (_proxies.Count == 0) return null;
        return PickAvailable(_proxies, _proxyFailures, ref _proxyCounter, excludeProxy: excluded);
    }

    private (int Index, byte[]? Bytes) GetNextCookie()
    {
        if (_cookies.Count == 0) return (-1, null);
        var idx = PickAvailableIndex(_cookies.Count, _cookieFailures, ref _cookieCounter, exclude: -1);
        return (idx, _cookies[idx]);
    }

    private (int Index, byte[]? Bytes) GetNextCookieExcluding(int excluded)
    {
        if (_cookies.Count == 0) return (-1, null);
        var idx = PickAvailableIndex(_cookies.Count, _cookieFailures, ref _cookieCounter, exclude: excluded);
        return (idx, _cookies[idx]);
    }

    private string PickAvailable(
        IReadOnlyList<string> items,
        ConcurrentDictionary<string, DateTimeOffset> failures,
        ref long counter,
        string? excludeProxy)
    {
        for (int attempt = 0; attempt < items.Count; attempt++)
        {
            var idx = (int)(Interlocked.Increment(ref counter) % items.Count);
            var item = items[idx];
            if (item == excludeProxy) continue;
            if (!IsOnCooldown(failures, item)) return item;
        }

        // All on cooldown — return the one that failed longest ago (excluding current if possible)
        _logger.LogWarning("All {Count} proxies on cooldown; picking oldest-failed", items.Count);
        return items
            .Where(p => p != excludeProxy || items.Count == 1)
            .OrderBy(p => failures.TryGetValue(p, out var t) ? t : DateTimeOffset.MinValue)
            .First();
    }

    private int PickAvailableIndex(
        int count,
        ConcurrentDictionary<int, DateTimeOffset> failures,
        ref long counter,
        int exclude)
    {
        for (int attempt = 0; attempt < count; attempt++)
        {
            var idx = (int)(Interlocked.Increment(ref counter) % count);
            if (idx == exclude) continue;
            if (!IsOnCooldown(failures, idx)) return idx;
        }

        _logger.LogWarning("All {Count} cookie sets on cooldown; picking oldest-failed", count);
        return Enumerable.Range(0, count)
            .Where(i => i != exclude || count == 1)
            .OrderBy(i => failures.TryGetValue(i, out var t) ? t : DateTimeOffset.MinValue)
            .First();
    }

    private bool IsOnCooldown<TKey>(ConcurrentDictionary<TKey, DateTimeOffset> failures, TKey key) where TKey : notnull
        => failures.TryGetValue(key, out var failedAt) && DateTimeOffset.UtcNow - failedAt < _cooldown;

    // ── Configuration loaders ─────────────────────────────────────────────────

    private static IReadOnlyList<string> LoadProxies(IConfiguration configuration)
    {
        // Priority 1: YouTube:ProxyUrls:0, YouTube:ProxyUrls:1, ... (environment array)
        var section = configuration.GetSection("YouTube:ProxyUrls");
        var indexed = section.GetChildren()
            .Select(c => c.Value)
            .OfType<string>()
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .ToList();
        if (indexed.Count > 0) return indexed;

        // Priority 2: YouTube:ProxyUrl as comma/newline/semicolon-separated list
        var csv = configuration["YouTube:ProxyUrl"] ?? "";
        return csv
            .Split(new[] { ',', '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => s.Length > 0)
            .ToList();
    }

    private static IReadOnlyList<byte[]> LoadCookies(IConfiguration configuration)
    {
        // Priority 1: YouTube:CookiesList:0, YouTube:CookiesList:1, ... (environment array)
        var section = configuration.GetSection("YouTube:CookiesList");
        var indexed = section.GetChildren()
            .Select(c => c.Value)
            .OfType<string>()
            .ToList();

        // Priority 2: fall back to single YouTube:CookiesBase64
        var sources = indexed.Count > 0
            ? indexed
            : new[] { configuration["YouTube:CookiesBase64"] ?? "" }
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();

        var results = new List<byte[]>();
        foreach (var b64 in sources)
        {
            if (string.IsNullOrWhiteSpace(b64)) continue;
            var clean = Regex.Replace(b64.Trim(), @"\s+", "");
            if (clean.StartsWith("secretref:", StringComparison.OrdinalIgnoreCase)) continue;
            try { results.Add(Convert.FromBase64String(clean)); }
            catch (FormatException) { /* skip invalid base64 */ }
        }
        return results;
    }
}
