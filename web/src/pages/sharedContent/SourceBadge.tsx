import React from 'react';
import { FileText, MessageCircle, Youtube, Mic, Rss, FileVideo, Clapperboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EXTERNAL_SOURCE_BRANDING, isExternalVideoSource } from '../../constants/videoSources';
import type { NormalizedSourceType } from './SharedMedia';

interface BadgeStyle {
  label: string;
  icon?: LucideIcon;
  /** Used instead of `icon` for brands that only ship as an image (Bilibili). */
  img?: string;
  className: string;
}

const SOURCE_BADGES: Partial<Record<NormalizedSourceType, BadgeStyle>> = {
  chat: { label: 'AI Chat', icon: MessageCircle, className: 'bg-primary/10 text-primary border-primary/15' },
  youtube: { label: 'YouTube Video', icon: Youtube, className: 'bg-red-50 text-red-500 border-red-100' },
  bilibili: { label: 'Bilibili Video', img: '/images/bilibili.png', className: 'bg-sky-50 text-sky-600 border-sky-100' },
  upload: { label: 'Uploaded Video', icon: FileVideo, className: 'bg-primary/10 text-primary border-primary/15' },
  audio: { label: 'Audio', icon: Mic, className: 'bg-amber-50 text-amber-600 border-amber-100' },
  podcast: { label: 'Podcast', icon: Rss, className: 'bg-amber-50 text-amber-600 border-amber-100' },
  article: { label: 'Article', icon: FileText, className: 'bg-teal-50 text-teal-600 border-teal-100' },
  document: { label: 'Document', icon: FileText, className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
};

/** Vimeo/TED/Dailymotion/… have no hand-written entry above; they borrow their own brand label. */
const badgeFor = (type: NormalizedSourceType): BadgeStyle | undefined =>
  SOURCE_BADGES[type]
  ?? (isExternalVideoSource(type)
    ? {
      label: `${EXTERNAL_SOURCE_BRANDING[type].label} Video`,
      icon: Clapperboard,
      className: `bg-zinc-100 border-zinc-200 ${EXTERNAL_SOURCE_BRANDING[type].text}`,
    }
    : undefined);

/** The pill naming where a share came from, shown beside the "Shared …" pill in the page header. */
export const SourceBadge: React.FC<{ type: NormalizedSourceType }> = ({ type }) => {
  const badge = badgeFor(type);
  if (!badge) return null;
  const Icon = badge.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.className}`}>
      {badge.img
        ? <img src={badge.img} alt="" className="h-3 w-3 object-contain" />
        : Icon && <Icon size={11} />}
      {badge.label}
    </span>
  );
};
