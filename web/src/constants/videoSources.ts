// Shared registry for URL-based external video sources beyond YouTube/Bilibili.
// Used by the summarizer tab (URL parsing, branding) and the detail page (player embed).
// Adding a source here + the backend NormalizeSourceType switch is all that's needed:
// transcripts flow through the generic yt-dlp captions → Whisper pipeline by full URL.

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

/** Bilibili videoId key matching the stored convention: `BV…` or `BV…:pN` for multi-part pages. */
export function parseBilibiliKey(url: string): string | null {
  const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
  if (!m) return null;
  const page = Number.parseInt(url.match(/[?&]p=(\d+)/)?.[1] ?? '1', 10) || 1;
  return page > 1 ? `${m[1]}:p${page}` : m[1];
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

export interface ExternalSourceBranding {
  label: string;
  placeholder: string;
  /** Tailwind classes for the brand accent. */
  badgeBg: string;
  text: string;
  border: string;
  ring: string;
  glow: string;
  buttonBg: string;
  hoverBorder: string;
  hoverBg: string;
  focusBg: string;
  shadow: string;
}

export const EXTERNAL_SOURCE_BRANDING: Record<ExternalVideoSource, ExternalSourceBranding> = {
  vimeo: {
    label: 'Vimeo',
    placeholder: 'https://vimeo.com/76979871',
    badgeBg: 'bg-cyan-500',
    text: 'text-cyan-500',
    border: 'border-cyan-400',
    ring: 'ring-cyan-400/20',
    glow: 'bg-cyan-500',
    buttonBg: 'bg-cyan-500 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40',
    hoverBorder: 'hover:border-cyan-300/60',
    hoverBg: 'hover:bg-cyan-50/10',
    focusBg: 'bg-cyan-50/30',
    shadow: 'shadow-cyan-100',
  },
  ted: {
    label: 'TED',
    placeholder: 'https://www.ted.com/talks/your_talk_slug',
    badgeBg: 'bg-rose-600',
    text: 'text-rose-600',
    border: 'border-rose-400',
    ring: 'ring-rose-400/20',
    glow: 'bg-rose-600',
    buttonBg: 'bg-rose-600 text-white shadow-rose-600/20 hover:shadow-rose-600/40',
    hoverBorder: 'hover:border-rose-300/60',
    hoverBg: 'hover:bg-rose-50/10',
    focusBg: 'bg-rose-50/30',
    shadow: 'shadow-rose-100',
  },
  dailymotion: {
    label: 'Dailymotion',
    placeholder: 'https://www.dailymotion.com/video/x84sh87',
    badgeBg: 'bg-indigo-500',
    text: 'text-indigo-500',
    border: 'border-indigo-400',
    ring: 'ring-indigo-400/20',
    glow: 'bg-indigo-500',
    buttonBg: 'bg-indigo-500 text-white shadow-indigo-500/20 hover:shadow-indigo-500/40',
    hoverBorder: 'hover:border-indigo-300/60',
    hoverBg: 'hover:bg-indigo-50/10',
    focusBg: 'bg-indigo-50/30',
    shadow: 'shadow-indigo-100',
  },
  facebook: {
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/watch?v=1234567890 or fb.watch/…',
    badgeBg: 'bg-blue-600',
    text: 'text-blue-600',
    border: 'border-blue-400',
    ring: 'ring-blue-400/20',
    glow: 'bg-blue-600',
    buttonBg: 'bg-blue-600 text-white shadow-blue-600/20 hover:shadow-blue-600/40',
    hoverBorder: 'hover:border-blue-300/60',
    hoverBg: 'hover:bg-blue-50/10',
    focusBg: 'bg-blue-50/30',
    shadow: 'shadow-blue-100',
  },
  instagram: {
    label: 'Instagram',
    placeholder: 'https://www.instagram.com/reel/Cxyz123AbCd/',
    badgeBg: 'bg-pink-500',
    text: 'text-pink-500',
    border: 'border-pink-400',
    ring: 'ring-pink-400/20',
    glow: 'bg-pink-500',
    buttonBg: 'bg-pink-500 text-white shadow-pink-500/20 hover:shadow-pink-500/40',
    hoverBorder: 'hover:border-pink-300/60',
    hoverBg: 'hover:bg-pink-50/10',
    focusBg: 'bg-pink-50/30',
    shadow: 'shadow-pink-100',
  },
  twitter: {
    label: 'X (Twitter)',
    placeholder: 'https://x.com/username/status/1234567890123456789',
    badgeBg: 'bg-zinc-800',
    text: 'text-zinc-800',
    border: 'border-zinc-500',
    ring: 'ring-zinc-500/20',
    glow: 'bg-zinc-800',
    buttonBg: 'bg-zinc-800 text-white shadow-zinc-800/20 hover:shadow-zinc-800/40',
    hoverBorder: 'hover:border-zinc-400/60',
    hoverBg: 'hover:bg-zinc-50/30',
    focusBg: 'bg-zinc-50/50',
    shadow: 'shadow-zinc-200',
  },
  reddit: {
    label: 'Reddit',
    placeholder: 'https://www.reddit.com/r/videos/comments/abc123/…',
    badgeBg: 'bg-orange-600',
    text: 'text-orange-600',
    border: 'border-orange-400',
    ring: 'ring-orange-400/20',
    glow: 'bg-orange-600',
    buttonBg: 'bg-orange-600 text-white shadow-orange-600/20 hover:shadow-orange-600/40',
    hoverBorder: 'hover:border-orange-300/60',
    hoverBg: 'hover:bg-orange-50/10',
    focusBg: 'bg-orange-50/30',
    shadow: 'shadow-orange-100',
  },
  tiktok: {
    label: 'TikTok',
    placeholder: 'https://www.tiktok.com/@username/video/7123456789012345678',
    badgeBg: 'bg-teal-500',
    text: 'text-teal-500',
    border: 'border-teal-400',
    ring: 'ring-teal-400/20',
    glow: 'bg-teal-500',
    buttonBg: 'bg-teal-500 text-white shadow-teal-500/20 hover:shadow-teal-500/40',
    hoverBorder: 'hover:border-teal-300/60',
    hoverBg: 'hover:bg-teal-50/10',
    focusBg: 'bg-teal-50/30',
    shadow: 'shadow-teal-100',
  },
  linkedin: {
    label: 'LinkedIn',
    placeholder: 'https://www.linkedin.com/posts/user-name_topic-activity-7123456789012345678-abcd',
    badgeBg: 'bg-sky-700',
    text: 'text-sky-700',
    border: 'border-sky-500',
    ring: 'ring-sky-500/20',
    glow: 'bg-sky-700',
    buttonBg: 'bg-sky-700 text-white shadow-sky-700/20 hover:shadow-sky-700/40',
    hoverBorder: 'hover:border-sky-300/60',
    hoverBg: 'hover:bg-sky-50/10',
    focusBg: 'bg-sky-50/30',
    shadow: 'shadow-sky-100',
  },
};

/** Branding for every URL-pasteable source — externals plus YouTube/Bilibili (for the auto-detect tab). */
export const URL_SOURCE_BRANDING: Record<UrlVideoSource, ExternalSourceBranding> = {
  ...EXTERNAL_SOURCE_BRANDING,
  youtube: {
    label: 'YouTube',
    placeholder: 'https://www.youtube.com/watch?v=…',
    badgeBg: 'bg-red-500',
    text: 'text-red-500',
    border: 'border-red-400',
    ring: 'ring-red-400/20',
    glow: 'bg-red-500',
    buttonBg: 'bg-red-500 text-white shadow-red-500/20 hover:shadow-red-500/40',
    hoverBorder: 'hover:border-red-300/60',
    hoverBg: 'hover:bg-red-50/10',
    focusBg: 'bg-red-50/30',
    shadow: 'shadow-red-100',
  },
  bilibili: {
    label: 'Bilibili',
    placeholder: 'https://www.bilibili.com/video/BV…',
    badgeBg: 'bg-sky-500',
    text: 'text-sky-500',
    border: 'border-sky-400',
    ring: 'ring-sky-400/20',
    glow: 'bg-sky-500',
    buttonBg: 'bg-sky-500 text-white shadow-sky-500/20 hover:shadow-sky-500/40',
    hoverBorder: 'hover:border-sky-300/60',
    hoverBg: 'hover:bg-sky-50/10',
    focusBg: 'bg-sky-50/30',
    shadow: 'shadow-sky-100',
  },
};
