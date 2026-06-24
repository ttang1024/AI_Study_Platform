using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

// yt-dlp process invocation, failure classification & thumbnail selection.
public partial class YouTubeTranscriptService
{
    private async Task<string> RunYtDlpAsync(IEnumerable<string> args, CancellationToken ct)
    {
        var argList = args.ToList();
        Exception? lastException = null;

        var credentials = _pool.GetNext();

        for (int attempt = 0; attempt < MaxYtDlpAttempts; attempt++)
        {
            var (proxy, cookieIndex, cookieBytes) = credentials;

            string? cookieFile = null;
            if (cookieBytes is { Length: > 0 })
            {
                cookieFile = Path.GetTempFileName();
                await File.WriteAllBytesAsync(cookieFile, cookieBytes, ct);
            }

            try
            {
                var (exitCode, stdout, stderr) = await RunProcessAsync(argList, proxy, cookieFile, ct);

                if (exitCode == 0)
                {
                    if (attempt > 0)
                        _logger.LogInformation("yt-dlp succeeded on attempt {Attempt} (proxy={Proxy}, cookie={Cookie})",
                            attempt + 1, proxy ?? "none", cookieIndex);
                    return stdout;
                }

                var failure = ClassifyFailure(stderr);
                _logger.LogWarning(
                    "yt-dlp attempt {Attempt}/{Max} failed ({Type}): {Error}",
                    attempt + 1, MaxYtDlpAttempts, failure, stderr.Trim().Split('\n')[^1]);

                lastException = new InvalidOperationException($"yt-dlp exited {exitCode}: {stderr.Trim()}");

                switch (failure)
                {
                    case YtDlpFailureType.ProxyError:
                        _pool.ReportProxyFailure(proxy);
                        credentials = _pool.GetNextExcludingProxy(proxy);
                        break;

                    case YtDlpFailureType.BotDetection:
                        _pool.ReportCookieFailure(cookieIndex);
                        credentials = _pool.GetNextExcludingCookie(proxy, cookieIndex);
                        break;

                    case YtDlpFailureType.NotRetryable:
                        // Video unavailable, private, no subtitles, etc. — stop immediately.
                        throw lastException;
                }
            }
            finally
            {
                if (cookieFile != null && File.Exists(cookieFile))
                    File.Delete(cookieFile);
            }
        }

        throw lastException ?? new InvalidOperationException("yt-dlp failed after all retry attempts");
    }

    private static async Task<(int ExitCode, string Stdout, string Stderr)> RunProcessAsync(
        IReadOnlyList<string> baseArgs, string? proxy, string? cookieFile, CancellationToken ct)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "yt-dlp",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var arg in baseArgs)
            process.StartInfo.ArgumentList.Add(arg);

        if (!string.IsNullOrWhiteSpace(proxy))
        {
            process.StartInfo.ArgumentList.Add("--proxy");
            process.StartInfo.ArgumentList.Add(proxy);
        }

        if (cookieFile != null)
        {
            process.StartInfo.ArgumentList.Add("--cookies");
            process.StartInfo.ArgumentList.Add(cookieFile);
        }

        process.Start();

        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        return (process.ExitCode, await stdoutTask, await stderrTask);
    }

    // ── Failure classification ────────────────────────────────────────────────

    private enum YtDlpFailureType { ProxyError, BotDetection, NotRetryable, Unknown }

    private static YtDlpFailureType ClassifyFailure(string stderr)
    {
        var s = stderr.ToLowerInvariant();

        if (s.Contains("unable to connect to proxy")
            || s.Contains("proxy connection failed")
            || s.Contains("tunnel connection failed")
            || s.Contains("connection refused")
            || s.Contains("proxyconnect tcp")
            || s.Contains("proxy error"))
            return YtDlpFailureType.ProxyError;

        if (s.Contains("sign in to confirm")
            || s.Contains("are you a robot")
            || s.Contains("confirm you're not a robot")
            || s.Contains("please sign in")
            || s.Contains("http error 429")
            || s.Contains("too many requests")
            || s.Contains("http error 403"))
            return YtDlpFailureType.BotDetection;

        if (s.Contains("video unavailable")
            || s.Contains("private video")
            || s.Contains("this video is not available")
            || s.Contains("video has been removed")
            || s.Contains("no subtitles"))
            return YtDlpFailureType.NotRetryable;

        return YtDlpFailureType.Unknown;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static bool IsConnectivityFailure(Exception ex, CancellationToken ct)
    {
        if (ct.IsCancellationRequested) return false;
        return ex is TaskCanceledException or TimeoutException
            || ex.InnerException is TaskCanceledException or TimeoutException;
    }

    private static string? GetBestThumbnail(JsonElement entry)
    {
        if (!entry.TryGetProperty("thumbnails", out var thumbnails)) return null;
        string? best = null;
        var bestWidth = 0;
        foreach (var t in thumbnails.EnumerateArray())
        {
            var url = t.TryGetProperty("url", out var u) ? u.GetString() : null;
            var width = t.TryGetProperty("width", out var w) ? w.GetInt32() : 0;
            if (url != null && width > bestWidth) { best = url; bestWidth = width; }
        }
        return best;
    }

}
