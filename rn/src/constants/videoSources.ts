// Ported from web/src/constants/videoSources.ts — parsing/detection logic only.
// Branding is a plain hex-color map here (StyleSheet, not Tailwind) instead of the
// web version's Tailwind class bags.

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

/** Parse the platform-native video id for any URL-based source. */
export function parseUrlVideoId(source: UrlVideoSource, url: string): string | null {
  if (source === 'youtube') return parseYouTubeId(url);
  if (source === 'bilibili') return parseBilibiliKey(url);
  return parseExternalVideoId(source, url);
}

export interface UrlSourceBranding {
  label: string;
  placeholder: string;
  color: string;
}

export const URL_SOURCE_BRANDING: Record<UrlVideoSource, UrlSourceBranding> = {
  youtube: { label: 'YouTube', placeholder: 'https://www.youtube.com/watch?v=…', color: '#ef4444' },
  bilibili: { label: 'Bilibili', placeholder: 'https://www.bilibili.com/video/BV…', color: '#0ea5e9' },
  vimeo: { label: 'Vimeo', placeholder: 'https://vimeo.com/76979871', color: '#06b6d4' },
  ted: { label: 'TED', placeholder: 'https://www.ted.com/talks/your_talk_slug', color: '#e11d48' },
  dailymotion: { label: 'Dailymotion', placeholder: 'https://www.dailymotion.com/video/x84sh87', color: '#6366f1' },
  facebook: { label: 'Facebook', placeholder: 'https://www.facebook.com/watch?v=1234567890', color: '#2563eb' },
  instagram: { label: 'Instagram', placeholder: 'https://www.instagram.com/reel/Cxyz123AbCd/', color: '#ec4899' },
  twitter: { label: 'X (Twitter)', placeholder: 'https://x.com/username/status/1234567890123456789', color: '#27272a' },
  reddit: { label: 'Reddit', placeholder: 'https://www.reddit.com/r/videos/comments/abc123/…', color: '#ea580c' },
  linkedin: { label: 'LinkedIn', placeholder: 'https://www.linkedin.com/posts/…-activity-7123456789012345678-abcd', color: '#0369a1' },
  tiktok: { label: 'TikTok', placeholder: 'https://www.tiktok.com/@username/video/7123456789012345678', color: '#14b8a6' },
};
