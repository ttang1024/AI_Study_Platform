// Shared registry for URL-based external video sources beyond YouTube/Bilibili.
// Used by the summarizer tabs (URL parsing) and the detail pages (player embed)
// on web and rn. Adding a source here + the backend NormalizeSourceType switch
// is all that's needed: transcripts flow through the generic yt-dlp captions →
// Whisper pipeline by full URL. Branding stays per-app (Tailwind class bags on
// web, hex colors on rn) in each app's constants/videoSources.ts shim.

export type ExternalVideoSource =
  | 'vimeo' | 'ted' | 'dailymotion'
  | 'facebook' | 'instagram' | 'twitter' | 'reddit' | 'linkedin' | 'tiktok';
export type VideoSourceType = 'youtube' | 'bilibili' | 'upload' | ExternalVideoSource;

export const EXTERNAL_VIDEO_SOURCES: ExternalVideoSource[] = [
  'vimeo', 'ted', 'dailymotion', 'facebook', 'instagram', 'twitter', 'reddit', 'linkedin', 'tiktok',
];

export function isExternalVideoSource(source: string | undefined | null): source is ExternalVideoSource {
  return (EXTERNAL_VIDEO_SOURCES as string[]).includes(source ?? '');
}

/** Any source addable by pasting a URL (everything except file upload). */
export type UrlVideoSource = 'youtube' | 'bilibili' | ExternalVideoSource;

/** Identify the video site from a pasted URL by hostname. Null = unrecognized. */
export function detectVideoSource(url: string): UrlVideoSource | null {
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  const has = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (has('youtube.com') || has('youtu.be')) return 'youtube';
  if (has('bilibili.com')) return 'bilibili';
  if (has('vimeo.com')) return 'vimeo';
  if (has('ted.com')) return 'ted';
  if (has('dailymotion.com') || has('dai.ly')) return 'dailymotion';
  if (has('facebook.com') || has('fb.watch')) return 'facebook';
  if (has('instagram.com')) return 'instagram';
  if (has('twitter.com') || has('x.com')) return 'twitter';
  if (has('reddit.com') || has('redd.it')) return 'reddit';
  if (has('linkedin.com')) return 'linkedin';
  if (has('tiktok.com')) return 'tiktok';
  return null;
}

export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * A Bilibili video reference: the `BV…` id, the 1-based page of a multi-part
 * upload, and `key` — the videoId convention the backend stores (`BV…`, or
 * `BV…:pN` past page 1). URL parsing first so `?p=` is read as a real query
 * param; the regex fallback covers pasted fragments that aren't valid URLs.
 */
export interface BilibiliVideoRef {
  bvid: string;
  page: number;
  key: string;
}

export function parseBilibiliVideo(url: string): BilibiliVideoRef | null {
  const ref = (bvid: string, page: number): BilibiliVideoRef => ({
    bvid,
    page,
    key: page > 1 ? `${bvid}:p${page}` : bvid,
  });
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    return ref(m[1], Math.max(1, Number.parseInt(u.searchParams.get('p') ?? '1', 10) || 1));
  } catch {
    const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i)
      ?? url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
    if (!m) return null;
    return ref(m[1], Math.max(1, Number.parseInt(m[2] ?? '1', 10) || 1));
  }
}

/** Bilibili videoId key matching the stored convention: `BV…` or `BV…:pN` for multi-part pages. */
export function parseBilibiliKey(url: string): string | null {
  return parseBilibiliVideo(url)?.key ?? null;
}

/** Parse the platform-native video id for any URL-based source. */
export function parseUrlVideoId(source: UrlVideoSource, url: string): string | null {
  if (source === 'youtube') return parseYouTubeId(url);
  if (source === 'bilibili') return parseBilibiliKey(url);
  return parseExternalVideoId(source, url);
}

export function parseVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/|event\/)?(\d+)/i)
    ?? url.match(/player\.vimeo\.com\/video\/(\d+)/i);
  return m?.[1] ?? null;
}

export function parseTedSlug(url: string): string | null {
  const m = url.match(/ted\.com\/talks\/([A-Za-z0-9_]+)/i);
  return m?.[1] ?? null;
}

export function parseDailymotionId(url: string): string | null {
  const m = url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i)
    ?? url.match(/dai\.ly\/([a-z0-9]+)/i)
    ?? url.match(/dailymotion\.com\/embed\/video\/([a-z0-9]+)/i);
  return m?.[1] ?? null;
}

export function parseFacebookVideoId(url: string): string | null {
  const m = url.match(/facebook\.com\/[^?]*\/videos\/(\d+)/i)
    ?? url.match(/facebook\.com\/(?:watch|video\.php)[^#]*[?&]v=(\d+)/i)
    ?? url.match(/facebook\.com\/reel\/(\d+)/i)
    ?? url.match(/fb\.watch\/([A-Za-z0-9_-]+)/i)
    ?? url.match(/facebook\.com\/share\/[vr]\/([A-Za-z0-9_-]+)/i);
  return m?.[1] ?? null;
}

export function parseInstagramCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m?.[1] ?? null;
}

export function parseTweetId(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i);
  return m?.[1] ?? null;
}

export function parseRedditPostId(url: string): string | null {
  const m = url.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i)
    ?? url.match(/redd\.it\/([a-z0-9]+)/i);
  return m?.[1] ?? null;
}

export function parseTikTokId(url: string): string | null {
  // Numeric ids from full URLs; short-link codes (vm.tiktok.com/…, tiktok.com/t/…) are
  // accepted too — analysis works via the full URL, but the embed player needs a numeric id.
  const m = url.match(/tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/i)
    ?? url.match(/tiktok\.com\/(?:embed\/v2|v)\/(\d+)/i)
    ?? url.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/i)
    ?? url.match(/tiktok\.com\/t\/([A-Za-z0-9]+)/i);
  return m?.[1] ?? null;
}

export function parseLinkedInActivityId(url: string): string | null {
  const m = url.match(/linkedin\.com\/.*activity[-:](\d{10,})/i)
    ?? url.match(/urn:li:activity:(\d{10,})/i);
  return m?.[1] ?? null;
}

export function parseExternalVideoId(source: ExternalVideoSource, url: string): string | null {
  switch (source) {
    case 'vimeo': return parseVimeoId(url);
    case 'ted': return parseTedSlug(url);
    case 'dailymotion': return parseDailymotionId(url);
    case 'facebook': return parseFacebookVideoId(url);
    case 'instagram': return parseInstagramCode(url);
    case 'twitter': return parseTweetId(url);
    case 'reddit': return parseRedditPostId(url);
    case 'linkedin': return parseLinkedInActivityId(url);
    case 'tiktok': return parseTikTokId(url);
  }
}

/**
 * Embed player URL. `originalUrl` is required by sources whose embeds wrap the full
 * post URL (Facebook, Reddit). startSeconds > 0 also requests autoplay so
 * seeking-by-reload resumes playback; social embeds ignore it (no seek support).
 */
export function buildExternalEmbedUrl(
  source: ExternalVideoSource,
  videoId: string,
  originalUrl: string,
  startSeconds = 0,
): string {
  const s = Math.max(0, Math.floor(startSeconds));
  switch (source) {
    case 'vimeo':
      return s > 0
        ? `https://player.vimeo.com/video/${videoId}?autoplay=1#t=${s}s`
        : `https://player.vimeo.com/video/${videoId}`;
    case 'ted':
      // TED's embed player restarts on reload; the #t fragment is best-effort.
      return s > 0
        ? `https://embed.ted.com/talks/${videoId}?autoplay=true#t=${s}`
        : `https://embed.ted.com/talks/${videoId}`;
    case 'dailymotion':
      return s > 0
        ? `https://www.dailymotion.com/embed/video/${videoId}?start=${s}&autoplay=1`
        : `https://www.dailymotion.com/embed/video/${videoId}`;
    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(originalUrl)}&show_text=false`;
    case 'instagram':
      return `https://www.instagram.com/p/${videoId}/embed`;
    case 'twitter':
      return `https://platform.twitter.com/embed/Tweet.html?id=${videoId}`;
    case 'reddit': {
      try {
        const u = new URL(originalUrl);
        if (/(^|\.)reddit\.com$/i.test(u.hostname))
          return `https://embed.reddit.com${u.pathname}?embed=true`;
      } catch { /* fall through to id-only embed */ }
      return `https://embed.reddit.com/comments/${videoId}?embed=true`;
    }
    case 'linkedin':
      return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${videoId}`;
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${videoId}`;
  }
}

/** Bilibili's iframe player. `video` is what `parseBilibiliVideo` returned. */
export function buildBilibiliEmbedUrl(video: { bvid: string; page: number }, startSeconds = 0): string {
  const params = new URLSearchParams({ bvid: video.bvid, page: String(video.page) });
  const s = Math.max(0, Math.floor(startSeconds));
  if (s > 0) {
    params.set('t', String(s));
    params.set('autoplay', '1');
  }
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

export function buildYouTubeEmbedUrl(videoId: string, startSeconds = 0): string {
  const s = Math.max(0, Math.floor(startSeconds));
  return `https://www.youtube.com/embed/${videoId}${s > 0 ? `?start=${s}&autoplay=1` : ''}`;
}

/**
 * Embed URL for any source, dispatching on the stored `sourceType`. Null for
 * `upload` (which streams from our own API) and anything unrecognized, so
 * callers can fall back to their own player. `originalUrl` matters to the
 * sources whose embed wraps the full post URL (Bilibili pages, Facebook, Reddit).
 */
export function buildEmbedUrl(
  sourceType: string | undefined | null,
  videoId: string,
  originalUrl: string,
  startSeconds = 0,
): string | null {
  if (sourceType === 'youtube') return buildYouTubeEmbedUrl(videoId, startSeconds);
  if (sourceType === 'bilibili') {
    const video = parseBilibiliVideo(originalUrl) ?? { bvid: videoId, page: 1 };
    return buildBilibiliEmbedUrl(video, startSeconds);
  }
  if (isExternalVideoSource(sourceType)) {
    return buildExternalEmbedUrl(sourceType, videoId, originalUrl, startSeconds);
  }
  return null;
}
