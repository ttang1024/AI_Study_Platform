// Source types, URL detection/parsing, and embed-URL building moved to the
// shared package (@core/videoSources) — they were duplicated with web/.
// Re-exported here so existing imports keep working unchanged. Only the branding
// stays rn-local: a plain hex-color map (StyleSheet, not Tailwind) instead of the
// web version's Tailwind class bags.
export * from '@core/videoSources';
import type { UrlVideoSource } from '@core/videoSources';

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
