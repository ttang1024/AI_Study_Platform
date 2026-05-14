# YouTube

## Overview

Users can save YouTube videos into courses. The backend fetches captions with `yt-dlp`, rotates proxy/cookie credentials, and falls back to Whisper transcription when captions are unavailable. Transcripts power summaries, mind maps, flashcards, quizzes, glossary terms, worked problems, and chat.

## Routes

`YouTubeController` is mounted at `/api/youtube`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/transcript?videoId=` | Transcript segments |
| `GET` | `/subtitles?videoId=` | Raw subtitle segments |
| `GET` | `/playlist-items?playlistId=` | Playlist item discovery |
| `POST` | `/summary/stream` | SSE summary from URL |
| `POST` | `/mindmap` | Generate mind map from URL |
| `POST` | `/mindmap/stream` | SSE mind map from URL |
| `POST` | `/quiz` | Generate quiz from URL |
| `POST` | `/flashcards` | Generate flashcards from URL |
| `POST` | `/chat` | Standalone chat from URL/transcript |
| `POST` | `/videos` | Save video |
| `GET` | `/videos` | List saved videos with filters/paging |
| `GET` | `/videos/{id}` | Load saved video |
| `PATCH` | `/videos/{id}` | Update saved video generated fields |
| `PATCH` | `/videos/{id}/move` | Move saved video to another course |
| `DELETE` | `/videos/{id}` | Delete saved video |
| `GET/POST` | `/videos/{id}/chat` | Saved-video chat/history |
| `POST` | `/videos/{id}/chat/stream` | SSE saved-video chat |
| `DELETE` | `/videos/{id}/chat` | Clear saved-video chat |
| `GET/POST` | `/videos/{id}/flashcards...` | Saved-video flashcards |
| `GET/POST` | `/videos/{id}/glossary...` | Saved-video glossary |
| `GET/POST` | `/videos/{id}/quiz...` | Saved-video quizzes and submissions |
| `GET/POST` | `/videos/{id}/worked-problems...` | Saved-video worked problems |

There are frontend chapter service files, but the current backend has no `/chapters` routes.

## Transcript Pipeline

| Layer | Role |
| --- | --- |
| `YouTubeTranscriptService` memory cache | short-lived raw caption and Whisper segment cache |
| `YouTubeController` app cache | prepared-segment cache using `Cache:TranscriptSeconds` TTL |
| `YouTubeTranscriptEntry` DB table | persistent segment store keyed by `(VideoId, Kind)`, used as fallback when the app cache is cold |
| `YouTubeVideos.Transcript` | transcript text persisted after the first saved-video AI use |

`Kind` is either `transcript` (yt-dlp captions) or `subtitles` (auto-generated).

`PrepareTranscriptSegments` is applied before segments are served or stored. It merges raw caption fragments into 30–60 second windows (`MinTranscriptSegmentSeconds = 30`, `MaxTranscriptSegmentSeconds = 60`) and normalises each segment via `NormalizeTranscriptSentence` (capitalize first letter, ensure sentence-ending punctuation, strip whitespace before punctuation marks). A short trailing segment is merged into the previous one.

`TranscriptSegmentDto` carries `(StartSeconds, Text)`.

`YouTubeCredentialPool` is a singleton so failed proxies/cookies are tracked across requests.

## Transcript Pipeline — Code

### yt-dlp with proxy + cookie rotation

`RunYtDlpAsync` retries up to `MaxYtDlpAttempts = 5` times. After a proxy error it asks the pool for a different proxy; after bot-detection it rotates the cookie. Non-retryable errors (private video, no subtitles) throw immediately.

```csharp
// YouTubeTranscriptService.cs — yt-dlp retry loop
for (int attempt = 0; attempt < MaxYtDlpAttempts; attempt++)
{
    var (proxy, cookieIndex, cookieBytes) = credentials;
    // write cookie bytes to temp file ...
    var (exitCode, stdout, stderr) = await RunProcessAsync(argList, proxy, cookieFile, ct);

    if (exitCode == 0) return stdout;

    var failure = ClassifyFailure(stderr);
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
            throw lastException!;  // video unavailable, private, etc.
    }
}
```

### Subtitle URL selection

Manual English subtitles are preferred over auto-generated captions; `json3` format is required for millisecond timing data.

```csharp
// YouTubeTranscriptService.cs — FindSubtitleUrl
foreach (var trackKey in (string[])["subtitles", "automatic_captions"])
{
    foreach (var lang in tracks.EnumerateObject())
    {
        if (!lang.Name.StartsWith("en", StringComparison.OrdinalIgnoreCase)) continue;
        foreach (var fmt in lang.Value.EnumerateArray())
        {
            if (fmt.TryGetProperty("ext", out var ext) && ext.GetString() == "json3"
                && fmt.TryGetProperty("url", out var url))
                return url.GetString();
        }
    }
}
```

### Resegmentation (two-phase)

Raw captions are small fragments. `Resegment` runs two passes to produce clean 30–60 s segments for display and AI input.

```csharp
// YouTubeTranscriptService.cs — Resegment (abbreviated)

// Phase 1 — merge fragments into sentences
//   Flush at: sentence-ending punctuation, >2 s silence gap, 30 s time break, last caption
for (int i = 0; i < captions.Count; i++)
{
    sb.Append(text);
    bool sentenceEnd = EndsWithSentencePunctuation(current);
    bool silenceGap  = (captions[i+1].Offset - (offset + duration)).TotalSeconds > 2.0;
    bool timeBreak   = (offset - sentStart).TotalSeconds >= 30.0;

    if (sentenceEnd || silenceGap || lastCaption || timeBreak)
    {
        sentences.Add((sentStart, NormalizeSentencePunctuation(current)));
        sb.Clear();
    }
}

// Phase 2 — group sentences into 30–60 s segments
const double minSegmentSeconds = 30.0;
const double maxSegmentSeconds = 60.0;

for (int i = 0; i < sentences.Count; i++)
{
    segSb.Append(text);
    double segDuration = nextStartSec - segStart.TotalSeconds;
    if (segDuration >= minSegmentSeconds || segDuration >= maxSegmentSeconds || isLast)
    {
        result.Add(new TranscriptSegment(segStart, segSb.ToString().Trim()));
        segSb.Clear();
    }
}
```

### Sentence normalisation

```csharp
// YouTubeTranscriptService.cs — NormalizeSentencePunctuation
private static string NormalizeSentencePunctuation(string text)
{
    text = Regex.Replace(text.Trim(), @"\s+([,.;:!?])", "$1");  // strip space before punctuation
    text = AddCommonCommas(text);                                 // e.g. "however " → "however, "
    text = char.ToUpperInvariant(text[0]) + text[1..];           // capitalise first letter
    if (!EndsWithSentencePunctuation(text)) text += ".";         // ensure terminal punctuation
    return text;
}
```

### Whisper fallback

When yt-dlp captions are unavailable, `GetWhisperTranscriptAsync` downloads the audio with yt-dlp (`-x --audio-format m4a`), sends it to `WhisperTranscriptionService`, and caches the resulting segments for 10 minutes.

## Configuration

| Key | Meaning |
| --- | --- |
| `YouTube:ProxyUrls` / `YouTube:ProxyUrl` | proxy pool |
| `YouTube:CookiesList` / `YouTube:CookiesBase64` | base64 Netscape cookie files |
| `YouTube:ProxyCooldownMinutes` | cooldown for failed proxy/cookie entries |
| `YouTube:HttpTimeoutSeconds` | subtitle CDN HTTP timeout |
| `Cache:TranscriptSeconds` | controller transcript cache TTL |
