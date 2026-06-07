import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText, ChevronDown, ChevronUp, Youtube, Mic, Rss, ExternalLink, FileVideo,
} from 'lucide-react';
import { SharedContent } from '../../services/shareContentService';
import { getApiUrl } from '../../utils/env';
import { SharedDocumentViewer } from './SharedDocumentViewer';

const API_URL = getApiUrl();

export function parseYouTubeVideoId(url: string): string | null {
  return url.match(/(?:[?&]v=|youtu\.be\/|shorts\/|embed\/)([^&?/\s]{11})/)?.[1] ?? null;
}

export function parseBilibiliVideo(url: string): { bvid: string; page: number } | null {
  try {
    const u = new URL(url.trim());
    const match = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
    if (!match) return null;
    const page = Math.max(1, Number.parseInt(u.searchParams.get('p') ?? '1', 10) || 1);
    return { bvid: match[1], page };
  } catch {
    const match = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i)
      ?? url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
    if (!match) return null;
    const page = Math.max(1, Number.parseInt(match[2] ?? '1', 10) || 1);
    return { bvid: match[1], page };
  }
}

export type NormalizedSourceType =
  | 'youtube' | 'bilibili' | 'upload' | 'audio' | 'podcast' | 'article' | 'document' | 'chat';

interface SharedMediaProps {
  content: SharedContent;
  normalizedSourceType: NormalizedSourceType;
  articleHtml: string | null;
  articleCollapsed: boolean;
  onToggleArticle: () => void;
}

/** Renders the source media block (video/audio/document/article) for the public share page. */
export const SharedMedia: React.FC<SharedMediaProps> = ({
  content, normalizedSourceType, articleHtml, articleCollapsed, onToggleArticle,
}) => {
  if (normalizedSourceType === 'youtube' && content.sourceUrl) {
    const videoId = parseYouTubeVideoId(content.sourceUrl);
    return videoId ? (
      <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-black">
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] hover:bg-primary/5 transition-colors group"
        >
          <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center shrink-0">
            <Youtube size={13} className="text-white" />
          </div>
          <span className="flex-1 min-w-0 text-xs text-text-muted truncate">{content.sourceUrl}</span>
          <ExternalLink size={13} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
        </a>
        <div style={{ aspectRatio: '16/9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?rel=0`}
            title={content.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    ) : null;
  }

  if (normalizedSourceType === 'bilibili' && content.sourceUrl) {
    const video = parseBilibiliVideo(content.sourceUrl);
    return video ? (
      <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-black">
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] hover:bg-sky-50 transition-colors group"
        >
          <div className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center shrink-0">
            <img src="/images/bilibili-white.png" alt="" className="h-3.5 w-3.5 object-contain" />
          </div>
          <span className="flex-1 min-w-0 text-xs text-text-muted truncate">{content.sourceUrl}</span>
          <ExternalLink size={13} className="text-text-muted group-hover:text-sky-600 transition-colors shrink-0" />
        </a>
        <div style={{ aspectRatio: '16/9' }}>
          <iframe
            src={`https://player.bilibili.com/player.html?bvid=${video.bvid}&page=${video.page}`}
            title={content.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    ) : null;
  }

  if (normalizedSourceType === 'upload') {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <FileVideo size={13} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-text-muted truncate">{content.title}</span>
        </div>
        <div className="bg-black" style={{ aspectRatio: '16/9' }}>
          <video
            controls
            preload="metadata"
            className="h-full w-full"
            src={`${API_URL}/api/share/${content.token}/video`}
          />
        </div>
      </div>
    );
  }

  if (normalizedSourceType === 'audio') {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Mic size={13} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-text-muted truncate">{content.title}</span>
        </div>
        <div className="px-4 py-4">
          <audio controls className="w-full" src={`${API_URL}/api/share/${content.token}/audio`} />
        </div>
      </div>
    );
  }

  if (normalizedSourceType === 'podcast') {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
          <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
            <Rss size={13} className="text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-text-muted truncate flex-1">{content.title}</span>
        </div>
        {content.originalArticleUrl && (
          <a
            href={content.originalArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] hover:bg-amber-50 transition-colors group"
          >
            <Rss size={14} className="text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0 text-xs text-text-muted truncate group-hover:text-amber-600 transition-colors">
              Listen on Apple Podcasts
            </span>
            <ExternalLink size={12} className="text-text-muted group-hover:text-amber-500 transition-colors shrink-0" />
          </a>
        )}
        <div className="px-4 py-4">
          <audio controls className="w-full" src={`${API_URL}/api/share/${content.token}/audio`} />
        </div>
      </div>
    );
  }

  if (normalizedSourceType === 'document' && content.fileType) {
    return <SharedDocumentViewer token={content.token} fileType={content.fileType} />;
  }

  if (normalizedSourceType === 'article') {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <FileText size={13} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-text-muted flex-1">Original Article</span>
          <button
            onClick={onToggleArticle}
            className="rounded-lg p-1 text-text-muted hover:text-text-main hover:bg-[var(--bg-app)] transition-colors"
          >
            {articleCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
        {/* Original URL link bar */}
        {content.originalArticleUrl && (
          <a
            href={content.originalArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] hover:bg-primary/5 transition-colors group"
          >
            <ExternalLink size={14} className="text-primary shrink-0" />
            <span className="flex-1 min-w-0 text-xs text-text-muted truncate group-hover:text-primary transition-colors">
              {content.originalArticleUrl}
            </span>
            <ExternalLink size={12} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
          </a>
        )}
        {/* Content */}
        {!articleCollapsed && (
          articleHtml ? (
            <div className="prose prose-sm max-w-none p-6 text-text-main overflow-auto max-h-[600px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{articleHtml}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )
        )}
      </div>
    );
  }

  return null;
};
