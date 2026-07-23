import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { getDocDisplayName } from '../../utils/docName';
import { getDocumentKind, getDocumentRoute } from '../../utils/documentRoute';
import { Course } from '../../types';
import { VideoListItem, videoService } from '../../services/videoService';
import type { PendingItem } from './PendingItemsGrid';

// ── internal types ────────────────────────────────────────────────────────────

export type CardData = { id: string; front: string; back: string };
export type QuestionData = { id: string; question: string; options?: string[]; answer: string; explanation: string };

export type QuizPhase = 'answering' | 'submitted';

export type ModalState =
  | { kind: 'flashcards'; name: string; detailTo: string; cards: CardData[]; idx: number; isFlipped: boolean }
  | {
    kind: 'quiz';
    name: string;
    detailTo: string;
    questions: QuestionData[];
    item: PendingItem;
    phase: QuizPhase;
    currentQ: number;
    /** questionId → selected option letter (A/B/C/D) */
    selected: Record<string, string>;
    score?: number;
    submitting?: boolean;
  }
  | null;

// ── helpers ───────────────────────────────────────────────────────────────────

export function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const DOODLES = ['✦', '◆', '▲', '●', '✿', '❋', '⬟'];
export const PATTERNS = [
  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 10px)',
  'radial-gradient(ellipse at top right, rgba(255,255,255,0.2) 0%, transparent 60%)',
];

export const TYPE_META = {
  video:    { Icon: CONTENT_TYPE_ICONS.video.icon,    typeLabel: 'Video',                          emoji: CONTENT_TYPE_ICONS.video.emoji,    fallbackColor: CONTENT_TYPE_ICONS.video.color },
  audio:    { Icon: CONTENT_TYPE_ICONS.audio.icon,    typeLabel: CONTENT_TYPE_ICONS.audio.label,   emoji: CONTENT_TYPE_ICONS.audio.emoji,    fallbackColor: CONTENT_TYPE_ICONS.audio.color },
  article:  { Icon: CONTENT_TYPE_ICONS.article.icon,  typeLabel: CONTENT_TYPE_ICONS.article.label, emoji: CONTENT_TYPE_ICONS.article.emoji,  fallbackColor: CONTENT_TYPE_ICONS.article.color },
  document: { Icon: CONTENT_TYPE_ICONS.document.icon, typeLabel: CONTENT_TYPE_ICONS.document.label,emoji: CONTENT_TYPE_ICONS.document.emoji, fallbackColor: CONTENT_TYPE_ICONS.document.color },
};

export function getItemMeta(item: PendingItem, courses: Course[]) {
  if (item.kind === 'video') {
    const m = TYPE_META.video;
    return { ...m, id: item.video.id, name: item.video.title, accentColor: item.video.courseColor || m.fallbackColor, courseName: item.video.courseName || '', to: `/videos/${item.video.id}` };
  }
  const { doc } = item;
  const course = courses.find(c => c.id === doc.courseId);
  const m = TYPE_META[getDocumentKind(doc)];
  return {
    ...m,
    id: doc.id,
    name: getDocDisplayName(doc),
    accentColor: course?.color || m.fallbackColor,
    courseName: course?.name || '',
    to: getDocumentRoute(doc.id, doc),
  };
}

export function isCorrectOption(option: string, answer: string) {
  return option.trim().charAt(0).toUpperCase() === answer.trim().toUpperCase();
}

export function getVideoThumbnailSrc(video: VideoListItem) {
  if (video.sourceType === 'upload') return videoService.getUploadedVideoThumbnailUrl(video.id);
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.sourceType === 'bilibili') return '/images/bilibili.png';
  return video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : '';
}

export function getVideoFallbackThumbnail(video: VideoListItem) {
  if (video.sourceType === 'bilibili') return '/images/bilibili.png';
  if (video.sourceType === 'youtube' || !video.sourceType) {
    return video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : '';
  }
  return '';
}

export function getUploadedVideoPreviewSrc(video: VideoListItem) {
  return video.sourceType === 'upload' ? videoService.getUploadedVideoStreamUrl(video.id) : '';
}
