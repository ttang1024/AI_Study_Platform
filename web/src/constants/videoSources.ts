// Source types, URL detection/parsing, and embed-URL building moved to the
// shared package (@core/videoSources) — they were duplicated in rn/. Re-exported
// here so existing imports keep working unchanged. Only the branding stays
// web-local: it's Tailwind class bags, while rn uses plain hex colors.
// Adding a source still means: @core/videoSources + the backend
// NormalizeSourceType switch + a branding entry here.
export * from '@core/videoSources';
import type { ExternalVideoSource, UrlVideoSource } from '@core/videoSources';

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
